/**
 * App-shell — engine: backend-veje skallen har brug for.
 *
 *  1. fetchOwnProfiles()      — familiens børneprofiler (RLS: kun egne).
 *  2. migrateGuestProgress()  — engangs-flytning "tag dit lys med":
 *     gæste-fremskridt fra localStorage → progress-rækker på profilen.
 *
 * Forældre-porten (foran dashboardet) er IKKE her — siden Leverance B2 kan
 * den aktive session være et BARNS, ikke kun forælderens (barnets egen
 * session, se pin-login/child-signin), så porten kan ikke længere nøjes
 * med at "genindtaste kodeord for den allerede indloggede" — den skal
 * kunne skifte identitet helt. Det kræver adgang til session-skifte-guarden
 * (`authTransitionInFlight`), som bor i useAppShell selv. Se
 * useAppShell.submitGate.
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
      // streak_count IKKE sat: kolonnen er frosset siden Leverance 1.3
      // (streak er nu global på profiles, sat af record_progress()).
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
