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
  type Letter,
  type Profile,
  type Progress,
  type VocabularyWord,
} from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import { summarizeLearning, type ItemStat, type LearningSummary } from "./learning";

/** Oversatte beskeder — kaldestedet (useDashboard.ts, som har `t` fra `useLanguage()`) leverer dem. */
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
 * D2 — læringstal pr. barn (plan-boernesession-og-dashboard.md §6.1).
 *
 * Læser barnets tællere fra `profile_item_stats` (RLS-policyen
 * `profile_item_stats_owner_all` sikrer at forælderen kun ser egne børn —
 * ingen filtrering i UI'et gør arbejdet) plus de to kataloger, der udgør
 * nævneren. Selve fortolkningen ligger i `learning.ts`, som er ren og testet.
 *
 * Vocabulary-nævneren tæller kun UDGIVNE ord: kladder fra værkstedet er
 * ikke noget barnet kan møde i spillene, og må derfor ikke tælle med i
 * "34 af 107" — ellers ville tallet falde af sig selv, hver gang du
 * oprettede en kladde.
 */
export async function fetchLearningSummary(
  child: Profile,
  messages: DashboardMessages,
): Promise<{ ok: true; summary: LearningSummary } | { ok: false; error: string }> {
  const [statsRes, lettersRes, wordsRes] = await Promise.all([
    supabase
      .from("profile_item_stats")
      .select("item_type, item_id, seen_count, correct_count")
      .eq("profile_id", child.id),
    supabase.from("letters").select("*").order("position"),
    supabase.from("vocabulary").select("*").eq("is_published", true),
  ]);
  if (statsRes.error || lettersRes.error || wordsRes.error) {
    return { ok: false, error: messages.fetchLearningError };
  }
  return {
    ok: true,
    summary: summarizeLearning(
      (statsRes.data ?? []) as ItemStat[],
      (lettersRes.data ?? []) as Letter[],
      (wordsRes.data ?? []) as VocabularyWord[],
      messages,
    ),
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
 * D3.2 — hvor mange UDGIVNE ord findes der på hvert niveau. Bruges kun til
 * at vise forælderen hvad et niveau-valg reelt åbner ("36 ord tilgængelige
 * på dette niveau") — ét katalog-opslag, delt af alle børnekort i samme
 * dashboard-session (ikke profil-specifikt).
 */
export async function fetchLevelWordCounts(): Promise<Record<1 | 2 | 3 | 4, number>> {
  const counts: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const { data, error } = await supabase.from("vocabulary").select("level").eq("is_published", true);
  if (error || !data) return counts;
  for (const row of data as { level: number }[]) {
    if (row.level === 1 || row.level === 2 || row.level === 3 || row.level === 4) {
      counts[row.level] += 1;
    }
  }
  return counts;
}

/**
 * D3.2 — indstillinger pr. barn (§6.4/§2.2): transskription, sprogniveau,
 * dagens mål, barnets sprog. Skrives direkte via den eksisterende
 * `profiles_owner_all`-policy (forælder/admin) — INGEN ny RPC nødvendig,
 * database-drift-tjekket bekræftede at policyen allerede dækker kolonnerne.
 *
 * Vælges niveauet manuelt herfra, slukkes `level_auto_advance_enabled`
 * SAMTIDIG af kaldestedet (Dashboard.tsx) — se
 * supabase/migrations/README.md → "D3.1" for hvorfor det er nødvendigt for
 * at "forælder kan overstyre" er reelt og ikke kun kosmetisk.
 */
export interface ChildSettingsPatch {
  transliteration_enabled?: boolean;
  ui_language?: "da" | "ar";
  daily_goal_lessons?: 1 | 2 | 3 | 4 | 5;
  current_level?: 1 | 2 | 3 | 4;
  level_auto_advance_enabled?: boolean;
}

export async function updateChildSettings(
  profileId: string,
  patch: ChildSettingsPatch,
  messages: DashboardMessages,
): Promise<{ ok: true; profile: Profile } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", profileId)
    .select()
    .single();
  if (error || !data) return { ok: false, error: messages.settingsSaveError };
  return { ok: true, profile: data as Profile };
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
