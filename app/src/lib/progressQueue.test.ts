import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueAndSend,
  flushQueue,
  getPendingCount,
  startSyncEngine,
  type NewQueueEntry,
  type RecordProgressSender,
} from "./progressQueue";

// Frisk, isoleret IndexedDB-instans pr. test — ellers ville poster fra én
// test kunne lække ind i den næste (fake-indexeddb deler ellers global
// tilstand på tværs af hele testkørslen).
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeEntry(overrides: Partial<NewQueueEntry> = {}): NewQueueEntry {
  return {
    eventId: crypto.randomUUID(),
    profileId: "profile-ali",
    lessonId: "lesson-1",
    earnedXp: 10,
    currentStep: 1,
    completed: false,
    ...overrides,
  };
}

/**
 * Poller getPendingCount() indtil forventet værdi eller timeout.
 * Nødvendig fordi IndexedDB-operationer (også i fake-indexeddb) løses
 * asynkront over flere event loop-omgange — et fast antal
 * Promise.resolve()-ticks er ikke pålideligt nok.
 */
async function waitForPendingCount(expected: number, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if ((await getPendingCount()) === expected) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timeout: ventede på pending count ${expected}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const okSender: RecordProgressSender = vi.fn().mockResolvedValue({ error: null });
const failSender: RecordProgressSender = vi
  .fn()
  .mockResolvedValue({ error: { message: "offline" } });

describe("enqueueAndSend — grundtilstande", () => {
  it("sender med det samme og efterlader intet i køen, når online", async () => {
    const sender = vi.fn().mockResolvedValue({ error: null });
    const entry = makeEntry();

    const result = await enqueueAndSend(entry, sender);

    expect(result).toEqual({ ok: true, pending: false });
    // Senderen modtager den PERSISTEREDE post (inkl. enqueuedAt-tidsstempel
    // som blev tilføjet ved kø-skrivning), ikke det rå input 1:1.
    expect(sender).toHaveBeenCalledWith(expect.objectContaining(entry));
    expect(await getPendingCount()).toBe(0);
  });

  it("posten bliver TRYGT liggende i køen når afsendelse fejler (offline) — intet er tabt", async () => {
    const entry = makeEntry();

    const result = await enqueueAndSend(entry, failSender);

    expect(result).toEqual({ ok: true, pending: true });
    expect(await getPendingCount()).toBe(1);
  });
});

describe("Kø overlever 'genstart' (ny app-instans, samme IndexedDB)", () => {
  it("en post der ikke kunne sendes offline, findes stadig og sendes ved næste flush", async () => {
    const entry = makeEntry({ earnedXp: 15 });

    // "Session 1": offline, posten lægges i køen.
    await enqueueAndSend(entry, failSender);
    expect(await getPendingCount()).toBe(1);

    // "Session 2" (simuleret app-genstart — IndexedDB er den samme
    // fysiske database, ikke nulstillet, kun in-memory state er væk):
    // køen tømmes nu med en fungerende afsender.
    const { flushed, remaining } = await flushQueue(okSender);

    expect(flushed).toBe(1);
    expect(remaining).toBe(0);
    expect(await getPendingCount()).toBe(0);
    expect(okSender).toHaveBeenCalledWith(expect.objectContaining(entry));
  });
});

describe("Dobbeltsynk giver ikke dobbelt afsendelse", () => {
  it("en allerede afsendt (og fjernet) post sendes IKKE igen ved endnu en flush", async () => {
    const sender = vi.fn().mockResolvedValue({ error: null });
    const entry = makeEntry();

    await enqueueAndSend(entry, sender);
    expect(sender).toHaveBeenCalledTimes(1);

    // En ekstra synk (fx et 'online'-event der fyrer to gange i træk) må
    // ikke sende den samme, allerede-fjernede post igen.
    await flushQueue(sender);
    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("gentaget flushQueue-kald uden nye poster er et billigt no-op", async () => {
    const sender = vi.fn().mockResolvedValue({ error: null });

    const first = await flushQueue(sender);
    const second = await flushQueue(sender);

    expect(first).toEqual({ flushed: 0, remaining: 0 });
    expect(second).toEqual({ flushed: 0, remaining: 0 });
    expect(sender).not.toHaveBeenCalled();
  });
});

describe("Rækkefølge (FIFO) — forudsigelig konfliktløsning", () => {
  it("sender poster i den rækkefølge de blev lagt i køen", async () => {
    const order: string[] = [];
    const sender: RecordProgressSender = vi.fn().mockImplementation(async (entry) => {
      order.push(entry.eventId);
      return { error: null };
    });

    const a = makeEntry({ eventId: "a", currentStep: 1 });
    const b = makeEntry({ eventId: "b", currentStep: 2 });
    const c = makeEntry({ eventId: "c", currentStep: 3 });

    // Lægges i køen (offline), derefter tømt samlet — flushQueue skal
    // stadig respektere den oprindelige rækkefølge.
    await enqueueAndSend(a, failSender);
    await enqueueAndSend(b, failSender);
    await enqueueAndSend(c, failSender);
    expect(await getPendingCount()).toBe(3);

    await flushQueue(sender);

    expect(order).toEqual(["a", "b", "c"]);
    expect(await getPendingCount()).toBe(0);
  });

  it("stopper ved første fejl og bevarer resten i UÆNDRET rækkefølge (sender ikke ude af tur)", async () => {
    const attempted: string[] = [];
    const sender: RecordProgressSender = vi.fn().mockImplementation(async (entry) => {
      attempted.push(entry.eventId);
      // "b" fejler (netværket dør midt i synk) — "c" må ALDRIG forsøgt
      // sendt før "b" er lykkedes, ellers kan current_step ende forkert.
      if (entry.eventId === "b") return { error: { message: "netværk tabt" } };
      return { error: null };
    });

    await enqueueAndSend(makeEntry({ eventId: "a" }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "b" }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "c" }), failSender);

    const { flushed, remaining } = await flushQueue(sender);

    expect(attempted).toEqual(["a", "b"]); // "c" blev IKKE forsøgt
    expect(flushed).toBe(1);
    expect(remaining).toBe(2);
    expect(await getPendingCount()).toBe(2);

    // Næste synk-forsøg (fx et senere online-event) fortsætter korrekt
    // fra "b", i uændret rækkefølge.
    attempted.length = 0;
    const healthySender: RecordProgressSender = vi.fn().mockImplementation(async (entry) => {
      attempted.push(entry.eventId);
      return { error: null };
    });
    await flushQueue(healthySender);
    expect(attempted).toEqual(["b", "c"]);
    expect(await getPendingCount()).toBe(0);
  });
});

describe("Kø PR. PROFIL (fælde 5.1) — et profilskift må ikke blokere den nye profil", () => {
  it("Alis fejlende poster blokerer IKKE Zainabs poster i samme flush", async () => {
    const attempted: string[] = [];
    const sender: RecordProgressSender = vi.fn().mockImplementation(async (entry) => {
      attempted.push(entry.eventId);
      // Ali er "logget ud" — hans resterende poster afvises nu af serveren
      // (forkert/udløbet session), ligesom efter et rigtigt profilskift.
      if (entry.profileId === "profile-ali") {
        return { error: { message: "not authorized" } };
      }
      return { error: null };
    });

    // Ali har to poster i køen, kun den første når at blive forsøgt sendt
    // før profilskiftet (offline hele vejen, lægges bare i køen).
    await enqueueAndSend(makeEntry({ eventId: "ali-1", profileId: "profile-ali" }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "ali-2", profileId: "profile-ali" }), failSender);
    // Zainab logger ind på samme enhed og spiller også offline et øjeblik.
    await enqueueAndSend(makeEntry({ eventId: "zainab-1", profileId: "profile-zainab" }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "zainab-2", profileId: "profile-zainab" }), failSender);
    expect(await getPendingCount()).toBe(4);

    const { flushed, remaining } = await flushQueue(sender);

    // Ali: "ali-1" forsøgt og fejler → "ali-2" forsøges ALDRIG (rækkefølge
    // bevaret inden for Ali). Zainab: begge poster sendes uforstyrret,
    // UANSET at Ali fejlede.
    expect(attempted).toEqual(["ali-1", "zainab-1", "zainab-2"]);
    expect(flushed).toBe(2);
    expect(remaining).toBe(2);
    expect(await getPendingCount()).toBe(2);

    const stillQueued = await getPendingCount();
    expect(stillQueued).toBe(2); // begge er Alis ("ali-1" forsøgt igen næste gang, "ali-2" ventede aldrig)
  });

  it("rækkefølgen inden for én profil er stadig strengt FIFO, uændret af grupperingen", async () => {
    const attempted: string[] = [];
    const sender: RecordProgressSender = vi.fn().mockImplementation(async (entry) => {
      attempted.push(entry.eventId);
      return { error: null };
    });

    // Flettet rækkefølge i selve køen (Ali, Zainab, Ali, Zainab) — men hver
    // profils INTERNE rækkefølge skal stadig respekteres ved afsendelse.
    await enqueueAndSend(makeEntry({ eventId: "ali-a", profileId: "profile-ali", currentStep: 1 }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "zainab-a", profileId: "profile-zainab", currentStep: 1 }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "ali-b", profileId: "profile-ali", currentStep: 2 }), failSender);
    await enqueueAndSend(makeEntry({ eventId: "zainab-b", profileId: "profile-zainab", currentStep: 2 }), failSender);

    await flushQueue(sender);

    const aliOrder = attempted.filter((id) => id.startsWith("ali"));
    const zainabOrder = attempted.filter((id) => id.startsWith("zainab"));
    expect(aliOrder).toEqual(["ali-a", "ali-b"]);
    expect(zainabOrder).toEqual(["zainab-a", "zainab-b"]);
    expect(await getPendingCount()).toBe(0);
  });
});

describe("startSyncEngine", () => {
  it("tømmer køen med det samme og igen ved hvert 'online'-event", async () => {
    const sender = vi.fn().mockResolvedValue({ error: null });
    await enqueueAndSend(makeEntry({ eventId: "boot" }), failSender);
    expect(await getPendingCount()).toBe(1);

    const stop = startSyncEngine(sender);
    // Flush ved opstart kører asynkront (fire-and-forget by design) —
    // poll indtil IndexedDB-operationerne er færdige.
    await waitForPendingCount(0);

    await enqueueAndSend(makeEntry({ eventId: "offline-igen" }), failSender);
    expect(await getPendingCount()).toBe(1);

    window.dispatchEvent(new Event("online"));
    await waitForPendingCount(0);

    stop();
  });

  it("den returnerede oprydningsfunktion fjerner online-lytteren", async () => {
    const sender = vi.fn().mockResolvedValue({ error: null });
    const stop = startSyncEngine(sender);
    await waitForPendingCount(0); // initial-flush ved start skal være færdig først
    stop();

    await enqueueAndSend(makeEntry(), failSender);
    sender.mockClear();

    window.dispatchEvent(new Event("online"));
    // Giv en evt. (uønsket) lytter samme tid til at nå at køre som i den
    // positive test ovenfor, før vi konkluderer at den IKKE blev kaldt.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sender).not.toHaveBeenCalled();
  });
});
