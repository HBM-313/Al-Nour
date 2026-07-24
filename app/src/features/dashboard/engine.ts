/**
 * Forældre-dashboard — engine (Leverance D, plan-samtykke-flow.md).
 *
 * Alle læsninger/sletninger går gennem RLS-policyen `profiles_owner_all`
 * (owner_account_id = auth.uid()) — en forælder ser og sletter KUN egne
 * børn; databasen håndhæver det, ikke UI'et.
 *
 * GDPR ét-kliks-sletning: DELETE på profiles kaskaderer til progress og
 * class_members (ON DELETE CASCADE, verificeret mod live-DB 2026-07-19).
 * Al barnets data forsvinder i ét kald.
 */

import { supabase } from "@/lib/supabase";
import {
  ageSkinForBirthYear,
  stepsForSkin,
  type LessonStep,
  type Profile,
  type Progress,
} from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

/** Oversatte beskeder — kaldestedet (useDashboard.ts, som har `t = useT("da")`) leverer dem. */
export type DashboardMessages = Dictionary["dashboard"];

/** Hent forælderens børneprofiler, ældste først (stabil rækkefølge). */
export async function fetchChildren(
  messages: DashboardMessages,
): Promise<{ ok: true; children: Profile[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: messages.fetchChildrenError };
  return { ok: true, children: (data ?? []) as Profile[] };
}

export interface LessonProgressDot {
  orderIndex: number;
  state: "done" | "in_progress" | "not_started";
}

export interface ProgressSummary {
  lanterns: LessonProgressDot[]; // altid 7, i order_index-rækkefølge
  /** Sat når barnet er i gang med en lektion */
  current: { orderIndex: number; step: number; totalSteps: number } | null;
  completedCount: number;
  totalXp: number;
  /** Global streak for barnet (profiles.streak_count, Leverance 1.3) — ikke længere udledt af progress-rækkerne. */
  streakCount: number;
  /** true = barnet er slet ikke begyndt */
  empty: boolean;
}

/**
 * Opsummer barnets fremskridt i Bogstavernes Dal (lektion 1–7).
 * Trin-totalen for den igangværende lektion beregnes for barnets EGET
 * aldersskind (soft 4 / mid 5 / teen 6) via stepsForSkin.
 */
export async function fetchProgressSummary(
  child: Profile,
  messages: DashboardMessages,
): Promise<{ ok: true; summary: ProgressSummary } | { ok: false; error: string }> {
  const [lessonsRes, progressRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, order_index")
      .eq("world", "bogstavernes_dal")
      .gte("order_index", 1)
      .lte("order_index", 7)
      .order("order_index"),
    supabase.from("progress").select("*").eq("profile_id", child.id),
  ]);
  if (lessonsRes.error || progressRes.error) {
    return { ok: false, error: messages.fetchProgressError };
  }

  const lessons = lessonsRes.data ?? [];
  const byLesson = new Map<string, Progress>();
  for (const p of (progressRes.data ?? []) as Progress[]) byLesson.set(p.lesson_id, p);

  const lanterns: LessonProgressDot[] = [];
  let completedCount = 0;
  let totalXp = 0;
  let inProgress: { lessonId: string; orderIndex: number; step: number } | null = null;

  for (const l of lessons) {
    const p = byLesson.get(l.id);
    let state: LessonProgressDot["state"] = "not_started";
    if (p) {
      totalXp += p.xp;
      if (p.status === "completed") {
        state = "done";
        completedCount++;
      } else if (p.status === "in_progress") {
        state = "in_progress";
        inProgress = { lessonId: l.id, orderIndex: l.order_index, step: p.current_step };
      }
    }
    lanterns.push({ orderIndex: l.order_index, state });
  }

  let current: ProgressSummary["current"] = null;
  if (inProgress) {
    const stepsRes = await supabase
      .from("lesson_steps")
      .select("*")
      .eq("lesson_id", inProgress.lessonId)
      .order("order_index");
    const all = (stepsRes.data ?? []) as LessonStep[];
    const skinSteps = stepsForSkin(all, ageSkinForBirthYear(child.birth_year));
    current = {
      orderIndex: inProgress.orderIndex,
      // current_step er 0-baseret "næste trin" → vis 1-baseret, klemt til totalen
      step: Math.min(inProgress.step + 1, Math.max(skinSteps.length, 1)),
      totalSteps: Math.max(skinSteps.length, 1),
    };
  }

  return {
    ok: true,
    summary: {
      lanterns,
      current,
      completedCount,
      totalXp,
      streakCount: child.streak_count,
      empty: completedCount === 0 && current === null,
    },
  };
}

/**
 * Aktivér barnets egen identitet (Leverance B1/B2-forudsætning).
 * Kalder Edge Function `provision-child-auth`, som opretter en
 * `auth.users`-række med syntetisk e-mail og kobler den til profilen
 * (`profiles.auth_user_id`). Forælderens JWT sendes automatisk med af
 * `supabase.functions.invoke` — funktionen verificerer selv ejerskab via
 * RLS (`profiles_owner_all`), ingen egen logik her.
 *
 * Idempotent: kaldes profilen igen efter den allerede er aktiveret,
 * returneres blot `already_provisioned: true` — ingen fejl.
 */
export async function provisionChildAuth(
  profileId: string,
  messages: DashboardMessages,
): Promise<{ ok: true; alreadyProvisioned: boolean } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("provision-child-auth", {
    body: { profile_id: profileId },
  });
  if (error) {
    return { ok: false, error: messages.activateAccessError };
  }
  const res = data as { success?: boolean; already_provisioned?: boolean; error?: string } | null;
  if (!res?.success) {
    return { ok: false, error: res?.error ?? messages.unexpectedResponse };
  }
  return { ok: true, alreadyProvisioned: Boolean(res.already_provisioned) };
}

/**
 * GDPR ét-kliks-sletning: sletter profilen og — via ON DELETE CASCADE —
 * alt fremskridt og klasse-medlemskab. Pin-hashen bor på selve rækken og
 * forsvinder med den. Kan ikke fortrydes; UI'et SKAL bekræfte først.
 */
export async function deleteChildProfile(
  profileId: string,
  messages: DashboardMessages,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("profiles").delete().eq("id", profileId);
  if (error) return { ok: false, error: messages.deleteProfileError };
  return { ok: true };
}
