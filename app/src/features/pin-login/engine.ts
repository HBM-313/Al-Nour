/**
 * Pin-login — engine: dyre-pool, skind-parametre, RPC-kald mod
 * verify_child_pin/set_child_pin (fase1b_profiler_pin_samtykke).
 *
 * Hashen forlader ALDRIG databasen. Klienten sender kun pool-index-arrays
 * og modtager kun boolean. Ved netværksfejl: fail-closed (ingen adgang) —
 * se verifyPin().
 */

import { supabase } from "@/lib/supabase";
import type { AgeSkin } from "@/lib/types";

/**
 * Den faste dyre-pool. REKKEFØLGEN ER KONTRAKT: pin gemmes som pool-INDEX
 * (fx ['0','1','2']), ikke som emoji eller grid-position. Ændres denne
 * rækkefølge, invalideres alle eksisterende børnepins i databasen.
 * Godkendt i plan-pin-login-port.md — må ikke ændres uden ejer-beslutning.
 */
export const ANIMAL_POOL = [
  "🐱",
  "🐶",
  "🐰",
  "🐘",
  "🦁",
  "🐦",
  "🐟",
  "🐢",
  "🐻",
  "🦊",
  "🐼",
  "🐸",
] as const;

export interface PinSkinParams {
  /** Hvor mange dyr fra ANIMAL_POOL (fra start) vises i gitteret */
  animalCount: number;
  gridCols: number;
  /** Rækkefølge-tal (1., 2., 3.) over lys-pladserne — kun soft, kan slås fra */
  showOrderHint: boolean;
}

export const SKIN_PARAMS: Record<AgeSkin, PinSkinParams> = {
  soft: { animalCount: 9, gridCols: 3, showOrderHint: true },
  mid: { animalCount: 9, gridCols: 3, showOrderHint: false },
  teen: { animalCount: 12, gridCols: 4, showOrderHint: false },
};

/** Efter dette antal forkerte forsøg i træk: vis "hent en voksen" — aldrig lockout. */
export const ADULT_HELP_THRESHOLD = 2;

export type VerifyResult = "correct" | "incorrect" | "network_error";

/**
 * Tjek en indtastet pin-sekvens mod databasen via SECURITY DEFINER-RPC.
 * Fail-closed: enhver netværks-/RPC-fejl behandles som "ingen adgang",
 * aldrig som stiltiende korrekt.
 */
export async function verifyPin(
  profileId: string,
  attempt: readonly string[],
): Promise<VerifyResult> {
  try {
    const { data, error } = await supabase.rpc("verify_child_pin", {
      p_profile_id: profileId,
      p_attempt: [...attempt],
    });
    if (error) return "network_error";
    return data === true ? "correct" : "incorrect";
  } catch {
    return "network_error";
  }
}

export interface SetPinResult {
  ok: boolean;
  /** Sat når forælderen ikke er godkendt ejer af profilen, eller RPC fejler */
  error?: string;
}

/**
 * Sæt/ændr en profils pin. Kræver at den kaldende bruger er forælderens
 * konto (owner_account_id) eller admin — håndhævet i selve RPC'en
 * (set_child_pin), ikke kun i UI'et.
 */
export async function setPin(
  profileId: string,
  sequence: readonly string[],
): Promise<SetPinResult> {
  try {
    const { error } = await supabase.rpc("set_child_pin", {
      p_profile_id: profileId,
      p_sequence: [...sequence],
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
