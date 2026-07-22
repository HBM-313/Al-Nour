/**
 * Delt progress-gem for spillene: XP-akkumulering + dags-baseret streak.
 *
 * Leverance 1.2 (plan-platformsmodning.md §1.2): skriver ikke længere
 * "læs-derefter-skriv" fra klienten. Al xp-addition, streak- og
 * status-logik ligger i én atomisk Postgres-funktion (`record_progress`),
 * så to faner eller en kø-genafspilning ikke kan tabe xp eller ødelægge
 * streak. Streak-reglen (samme dag → uændret; i går → +1; ellers → 1) er
 * uændret — bare flyttet ind i RPC'en.
 *
 * Leverance 1.1: skriver ALTID gennem `progressQueue` (IndexedDB) FØRST,
 * som forsøger øjeblikkelig afsendelse og lader posten blive liggende
 * offline-sikkert hvis den fejler. `pending: true` i returværdien betyder
 * "gemt lokalt, venter på at blive synket" — intet fremskridt er tabt,
 * det er blot forsinket. Idempotens ved gensynk kommer fra RPC'ens
 * event_id-tjek (se progressQueue.ts).
 */

import { enqueueAndSend, type SaveOutcome } from "@/lib/progressQueue";

export async function saveRoundProgress(
  profileId: string,
  lessonId: string,
  earnedXp: number,
  eventId: string = crypto.randomUUID(),
): Promise<SaveOutcome> {
  return enqueueAndSend({
    eventId,
    profileId,
    lessonId,
    earnedXp,
    currentStep: 0,
    completed: true,
  });
}

/**
 * Gem pr. TRIN i en lektion — "fortsæt hvor du slap"-kontrakten.
 * currentStep er det NÆSTE trin barnet skal spille (0-baseret).
 * Kaldes efter hvert fuldført trin, så intet fremskridt kan tabes,
 * uanset hvornår sessionen forlades. Fuldført lektion nulstiller
 * trin-markøren til 0 (klar til genspil) — håndteret i RPC'en.
 */
export async function saveStepProgress(
  profileId: string,
  lessonId: string,
  currentStep: number,
  earnedXp: number,
  lessonCompleted: boolean,
  eventId: string = crypto.randomUUID(),
): Promise<SaveOutcome> {
  return enqueueAndSend({
    eventId,
    profileId,
    lessonId,
    earnedXp,
    currentStep,
    completed: lessonCompleted,
  });
}
