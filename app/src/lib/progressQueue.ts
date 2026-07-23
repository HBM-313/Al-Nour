/**
 * progressQueue — offline-skrivekø for PÅLOGGET PROFILS fremskridt.
 *
 * Leverance 1.1 (plan-platformsmodning.md §1.1), bygget oven på den
 * atomiske, idempotente `record_progress`-RPC fra Leverance 1.2.
 *
 * IndexedDB, ikke localStorage: tåler mere data, blokerer ikke UI-tråden,
 * og overlever at appen genstartes mens barnet er offline (familier med
 * ustabilt net, delt enhed). Forveksl ikke med `lib/localProgress.ts`,
 * som er noget andet: anonymt GÆSTE-fremskridt uden profil.
 *
 * Kontrakt: `saveStepProgress`/`saveRoundProgress` (progress.ts) skriver
 * ALTID til denne kø FØRST, forsøger derefter at sende med det samme.
 * Lykkes sendingen, fjernes posten. Fejler den (offline/netværksfejl),
 * bliver posten liggende og forsøges igen ved næste `online`-event eller
 * app-start (se `startSyncEngine`).
 *
 * Rækkefølge er vigtig og bevares STRENGT PR. PROFIL (FIFO, én ad gangen):
 * RPC'en sætter `current_step` direkte (ikke monotont, for at understøtte
 * at lektionen nulstilles ved fuldførelse) — sendes én profils poster ude
 * af rækkefølge, kan trin-markøren ende forkert. `flushQueue` stopper
 * derfor ved første fejl for EN GIVEN profil, men fortsætter uforstyrret
 * med de øvrige profilers poster.
 *
 * FÆLDE 5.1-FIX (plan-boernesession-og-dashboard.md, del 5.1, Leverance B2):
 * Køen er fysisk fælles for hele enheden. Før dette fix stoppede ÉN global
 * FIFO-løkke ved første fejl — men med barne-sessioner (B1/B2) betyder et
 * profilskift (Ali logger ud, Zainab logger ind) at Alis uafsendte poster
 * nu afvises af serveren (forkert session/ejerskab). Uden fixet ville det
 * stoppe hele køen permanent, og Zainabs fremskridt kunne ALDRIG komme
 * igennem. Løsningen: grupér poster pr. `profileId` og kør hver gruppes
 * FIFO uafhængigt af de andre — rækkefølgegarantien inden for én profil er
 * uændret, men en fejlet profil blokerer ikke længere de øvrige.
 *
 * Idempotens (ingen dobbelt-xp ved gensynk) kommer gratis fra
 * `record_progress`s event_id-tjek — hver kø-post får sit eget, holdbare
 * event_id ved OPRETTELSE (ikke ved afsendelse), så en app-genstart midt
 * i en afsendelse aldrig kan skabe to id'er for samme hændelse.
 */

export interface QueuedProgressEntry {
  eventId: string;
  profileId: string;
  lessonId: string;
  earnedXp: number;
  currentStep: number;
  completed: boolean;
  enqueuedAt: string;
}

export type NewQueueEntry = Omit<QueuedProgressEntry, "enqueuedAt">;

const DB_NAME = "nour_progress_queue";
const DB_VERSION = 1;
const STORE = "entries";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "eventId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error as unknown as Error);
  });
}

async function enqueue(entry: NewQueueEntry): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({
        ...entry,
        enqueuedAt: new Date().toISOString(),
      } satisfies QueuedProgressEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as unknown as Error);
    });
  } finally {
    db.close();
  }
}

async function removeFromQueue(eventId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(eventId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as unknown as Error);
    });
  } finally {
    db.close();
  }
}

/** Alle ventende poster, ældste først (FIFO — afsendelsesrækkefølgen). */
async function listQueued(): Promise<QueuedProgressEntry[]> {
  const db = await openDb();
  try {
    const entries = await new Promise<QueuedProgressEntry[]>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as QueuedProgressEntry[]);
        req.onerror = () => reject(req.error as unknown as Error);
      },
    );
    return entries.sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
  } finally {
    db.close();
  }
}

/** Kun til UI-status ("dit lys gemmes...") — antal poster der venter. */
export async function getPendingCount(): Promise<number> {
  try {
    return (await listQueued()).length;
  } catch {
    return 0;
  }
}

export interface RecordProgressSenderResult {
  error: { message: string } | null;
}

/** Injicerbar afsender, så kø-logikken kan testes uden Supabase/netværk. */
export type RecordProgressSender = (
  entry: NewQueueEntry,
) => Promise<RecordProgressSenderResult>;

/** Lazy import: rører aldrig Supabase-klienten, medmindre den rent faktisk skal bruges. */
async function defaultSender(
  entry: NewQueueEntry,
): Promise<RecordProgressSenderResult> {
  const { supabase } = await import("@/lib/supabase");
  const { error } = await supabase.rpc("record_progress", {
    p_event_id: entry.eventId,
    p_profile_id: entry.profileId,
    p_lesson_id: entry.lessonId,
    p_earned_xp: entry.earnedXp,
    p_current_step: entry.currentStep,
    p_completed: entry.completed,
  });
  return { error: error ? { message: error.message } : null };
}

/**
 * Tøm køen, gruppevis pr. profil, FIFO inden for hver gruppe. Stopper ved
 * første fejl (offline eller server-fejl) for EN profils poster — men
 * fortsætter uforstyrret med de øvrige profilers poster (fælde 5.1). Resten
 * forsøges igen ved næste kald (online-event eller app-start).
 */
export async function flushQueue(
  sender: RecordProgressSender = defaultSender,
): Promise<{ flushed: number; remaining: number }> {
  let entries: QueuedProgressEntry[];
  try {
    entries = await listQueued();
  } catch {
    // IndexedDB utilgængelig (privat browsing i nogle browsere, meget
    // gammel enhed) — fail-soft, intet at tømme.
    return { flushed: 0, remaining: 0 };
  }

  // listQueued() er allerede sorteret ældst-først, så grupperingen bevarer
  // FIFO-rækkefølgen inden for hver profil uden en ekstra sortering.
  const byProfile = new Map<string, QueuedProgressEntry[]>();
  for (const entry of entries) {
    const group = byProfile.get(entry.profileId);
    if (group) {
      group.push(entry);
    } else {
      byProfile.set(entry.profileId, [entry]);
    }
  }

  let flushed = 0;
  for (const profileEntries of byProfile.values()) {
    for (const entry of profileEntries) {
      const { error } = await sender(entry);
      if (error) break; // stop KUN denne profils resterende poster
      try {
        await removeFromQueue(entry.eventId);
        flushed++;
      } catch {
        // Kunne ikke fjerne posten efter succesfuld afsendelse — den
        // sendes igen næste gang, men det er harmløst: samme event_id
        // gør gentagelsen til et no-op i RPC'en.
        break;
      }
    }
  }

  const remaining = entries.length - flushed;
  return { flushed, remaining };
}

export interface SaveOutcome {
  /** Falsk KUN hvis hændelsen hverken kunne køes eller sendes — reelt tab. */
  ok: boolean;
  /**
   * Sand hvis hændelsen stadig venter i køen (offline/netværksfejl).
   * UI'et bruger dette til en rolig "dit lys gemmes, når du er online
   * igen"-status i stedet for et fejlikon — intet er tabt, kun forsinket.
   */
  pending: boolean;
}

/**
 * Skriv en fremskridts-hændelse til køen og forsøg straks at sende den.
 * Dette er indgangen `progress.ts` bruger.
 */
export async function enqueueAndSend(
  entry: NewQueueEntry,
  sender: RecordProgressSender = defaultSender,
): Promise<SaveOutcome> {
  try {
    await enqueue(entry);
  } catch {
    // IndexedDB utilgængelig — fail-soft direkte-send uden kø-garanti,
    // frem for at blokere spillet i browsere uden IndexedDB-understøttelse.
    const { error } = await sender(entry);
    return { ok: !error, pending: false };
  }

  await flushQueue(sender);
  const stillQueued = (
    await listQueued().catch(() => [] as QueuedProgressEntry[])
  ).some((e) => e.eventId === entry.eventId);

  // Ligger posten stadig i køen, er den IKKE tabt — den er trygt gemt og
  // forsøges igen senere (online-event eller næste app-start).
  return { ok: true, pending: stillQueued };
}

/**
 * Starter synk-motoren: tømmer køen med det samme (app-start) og igen
 * hver gang enheden bliver online. Returnerer en oprydningsfunktion.
 * Idempotent at kalde flere gange — men kaldes normalt kun én gang fra
 * app-skallen.
 */
export function startSyncEngine(
  sender: RecordProgressSender = defaultSender,
): () => void {
  const handler = () => {
    void flushQueue(sender);
  };
  void flushQueue(sender);
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
