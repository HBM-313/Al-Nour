/**
 * App-shell — engine: de tre backend-veje skallen har brug for.
 *
 *  1. fetchOwnProfiles()      — familiens børneprofiler (RLS: kun egne).
 *  2. verifyParentPassword()  — forældre-porten foran dashboardet: barnet
 *     må aldrig kunne nå slette-knapperne, så porten kræver forælderens
 *     adgangskode genindtastet (verificeres mod Supabase Auth, aldrig
 *     lokalt). Fail-closed: enhver fejl = ingen adgang.
 *  3. migrateGuestProgress()  — engangs-flytning "tag dit lys med":
 *     gæste-fremskridt fra localStorage → progress-rækker på profilen.
 *
 * MUREN: rører kun profiles/progress (persondata bag RLS) og Supabase
 * Auth — aldrig content/aqidah.
 */

import { supabase } from "@/lib/supabase";
import {
  clearLocalProgress,
  getLocalProgressSnapshot,
  hasLocalProgress,
} from "@/lib/localProgress";
import { ageSkinForBirthYear, type Profile } from "@/lib/types";

/** Familiens børneprofiler — RLS (`profiles_owner_all`) afgrænser til egne. */
export async function fetchOwnProfiles(): Promise<Profile[] | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  if (error) return null;
  return (data ?? []) as Profile[];
}

/**
 * Forældre-porten: bekræft adgangskoden for den ALLEREDE indloggede
 * forælder. Vi genbruger signInWithPassword mod sessionens egen e-mail —
 * korrekt kode fornyer blot sessionen, forkert kode afvises af GoTrue.
 * Fail-closed: mangler sessionen/e-mailen, eller fejler kaldet, er svaret nej.
 */
export async function verifyParentPassword(password: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  } catch {
    return false;
  }
}

export interface MigrationCheck {
  /** true når prompten "tag dit lys med" skal vises for denne profil */
  shouldOffer: boolean;
  /** antal lektioner med gæste-lys på enheden (til prompt-teksten) */
  guestLessonCount: number;
}

/**
 * Skal barnet tilbydes at tage gæste-lyset med? Kun når enheden HAR
 * gæste-fremskridt og profilen endnu INTET eget fremskridt har (ejer-
 * godkendt regel fra demoen) — ellers risikerer vi at blande to børns lys.
 */
export async function checkGuestMigration(
  profileId: string,
): Promise<MigrationCheck> {
  if (!hasLocalProgress()) return { shouldOffer: false, guestLessonCount: 0 };

  const { count, error } = await supabase
    .from("progress")
    .select("lesson_id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  // Fail-soft: kan vi ikke afgøre det, tilbyder vi IKKE migrering (hellere
  // vente end at overskrive noget vi ikke kunne se).
  if (error || (count ?? 0) > 0) return { shouldOffer: false, guestLessonCount: 0 };

  return {
    shouldOffer: true,
    guestLessonCount: Object.keys(getLocalProgressSnapshot()).length,
  };
}

/**
 * Flyt gæste-lyset ind på profilen. Pr. lektion:
 *  - posten for barnets EGET skind (fra fødselsåret) tages fuldt med
 *    (current_step er skind-relativt og kun gyldigt dér);
 *  - poster fra andre skind bidrager med completed + xp, men current_step
 *    nulstilles (vi genoptager aldrig på et forkert trin).
 * localStorage ryddes KUN efter succesfuld skrivning (samme lys kan
 * aldrig tages med to gange).
 */
export async function migrateGuestProgress(
  profile: Profile,
): Promise<{ ok: boolean }> {
  const snapshot = getLocalProgressSnapshot();
  const skin = ageSkinForBirthYear(profile.birth_year);
  const now = new Date().toISOString();

  const rows = Object.entries(snapshot).map(([lessonId, bySkin]) => {
    const own = bySkin[skin];
    const others = Object.values(bySkin).filter((p) => p && p !== own);
    const completed =
      (own?.completed ?? false) || others.some((p) => p?.completed);
    const xp =
      (own?.xp ?? 0) + others.reduce((sum, p) => sum + (p?.xp ?? 0), 0);
    return {
      profile_id: profile.id,
      lesson_id: lessonId,
      status: completed ? "completed" : "in_progress",
      current_step: completed ? 0 : (own?.current_step ?? 0),
      xp,
      streak_count: 1,
      last_completed_at: now,
    };
  });

  if (rows.length === 0) return { ok: true };

  const { error } = await supabase
    .from("progress")
    .upsert(rows, { onConflict: "profile_id,lesson_id" });
  if (error) return { ok: false };

  clearLocalProgress();
  return { ok: true };
}
