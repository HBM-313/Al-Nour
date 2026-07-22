/**
 * Delt progress-gem for spillene: XP-akkumulering + dags-baseret streak.
 *
 * Leverance 1.2 (plan-platformsmodning.md §1.2): skriver ikke længere
 * "læs-derefter-skriv" fra klienten. Al xp-addition, streak- og
 * status-logik ligger nu i én atomisk Postgres-funktion (`record_progress`),
 * så to faner eller en hurtig kø-genafspilning ikke kan tabe xp eller
 * ødelægge streak. Streak-reglen (samme dag → uændret; i går → +1;
 * ellers → 1) er uændret — bare flyttet ind i RPC'en.
 *
 * Idempotens: hvert kald bærer et event_id. Sendes samme event_id to gange
 * (fx en kø-post fra Leverance 1.1 der synkes igen efter en afbrudt
 * forbindelse), lægger RPC'en IKKE xp til igen — den er et bevidst no-op.
 * Kaldere der selv styrer retry (den kommende IndexedDB-kø) skal give deres
 * eget, holdbare event_id videre; almindelige online-kald kan lade et nyt
 * blive genereret automatisk.
 */

import { supabase } from "@/lib/supabase";

export async function saveRoundProgress(
  profileId: string,
  lessonId: string,
  earnedXp: number,
  eventId: string = crypto.randomUUID(),
): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc("record_progress", {
    p_event_id: eventId,
    p_profile_id: profileId,
    p_lesson_id: lessonId,
    p_earned_xp: earnedXp,
    p_current_step: 0,
    p_completed: true,
  });

  return { ok: !error };
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
): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc("record_progress", {
    p_event_id: eventId,
    p_profile_id: profileId,
    p_lesson_id: lessonId,
    p_earned_xp: earnedXp,
    p_current_step: currentStep,
    p_completed: lessonCompleted,
  });

  return { ok: !error };
}
