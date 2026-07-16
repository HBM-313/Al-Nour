/**
 * Delt progress-gem for spillene: XP-akkumulering + dags-baseret streak,
 * upsert på UNIQUE(profile_id, lesson_id).
 *
 * Streak-regel: samme dag → uændret; i går → +1; ellers → 1.
 */

import { supabase } from "@/lib/supabase";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isYesterday(prev: Date, now: Date): boolean {
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return dayKey(prev) === dayKey(y);
}

export async function saveRoundProgress(
  profileId: string,
  lessonId: string,
  earnedXp: number,
): Promise<{ ok: boolean }> {
  const existing = await supabase
    .from("progress")
    .select("xp, streak_count, last_completed_at")
    .eq("profile_id", profileId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existing.error) return { ok: false };

  const now = new Date();
  const prev = existing.data;
  const prevDate = prev?.last_completed_at
    ? new Date(prev.last_completed_at)
    : null;

  let streak = 1;
  if (prevDate && prev) {
    if (dayKey(prevDate) === dayKey(now)) streak = prev.streak_count;
    else if (isYesterday(prevDate, now)) streak = prev.streak_count + 1;
  }

  const { error } = await supabase.from("progress").upsert(
    {
      profile_id: profileId,
      lesson_id: lessonId,
      status: "completed",
      xp: (prev?.xp ?? 0) + earnedXp,
      streak_count: streak,
      last_completed_at: now.toISOString(),
    },
    { onConflict: "profile_id,lesson_id" },
  );

  return { ok: !error };
}

/**
 * Gem pr. TRIN i en lektion — "fortsæt hvor du slap"-kontrakten.
 * currentStep er det NÆSTE trin barnet skal spille (0-baseret).
 * Kaldes efter hvert fuldført trin, så intet fremskridt kan tabes,
 * uanset hvornår sessionen forlades. Samme streak-regel som runde-gem.
 */
export async function saveStepProgress(
  profileId: string,
  lessonId: string,
  currentStep: number,
  earnedXp: number,
  lessonCompleted: boolean,
): Promise<{ ok: boolean }> {
  const existing = await supabase
    .from("progress")
    .select("xp, streak_count, last_completed_at")
    .eq("profile_id", profileId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existing.error) return { ok: false };

  const now = new Date();
  const prev = existing.data;
  const prevDate = prev?.last_completed_at
    ? new Date(prev.last_completed_at)
    : null;

  let streak = 1;
  if (prevDate && prev) {
    if (dayKey(prevDate) === dayKey(now)) streak = prev.streak_count;
    else if (isYesterday(prevDate, now)) streak = prev.streak_count + 1;
  }

  const { error } = await supabase.from("progress").upsert(
    {
      profile_id: profileId,
      lesson_id: lessonId,
      status: lessonCompleted ? "completed" : "in_progress",
      // Fuldført lektion nulstiller trin-markøren (klar til genspil)
      current_step: lessonCompleted ? 0 : currentStep,
      xp: (prev?.xp ?? 0) + earnedXp,
      streak_count: streak,
      last_completed_at: now.toISOString(),
    },
    { onConflict: "profile_id,lesson_id" },
  );

  return { ok: !error };
}
