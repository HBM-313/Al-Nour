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
