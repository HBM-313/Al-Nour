/**
 * Pin-login — engine: dyre-pool, skind-parametre, + child-signin (Leverance
 * B2). set_child_pin (forælder sætter/ændrer et pin) er uændret.
 *
 * Hashen forlader ALDRIG databasen. Klienten sender kun pool-index-arrays.
 * Selve pin-tjekket sker nu via Edge Function `child-signin`, som er den
 * ENESTE vej ind (den gamle, statsløse `verify_child_pin`-RPC er låst ned —
 * den havde ingen rate limiting og ville have gjort attempt_child_pin's
 * rate limiter virkningsløs som en fri gætte-oracle). Ved succes udsteder
 * child-signin et engangs-login-token som skallen (useAppShell) indløser
 * med supabase.auth.verifyOtp() — det er her barnets EGEN session opstår.
 */

import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { RosterEntry } from "@/lib/childRoster";
import type { AgeSkin, Profile } from "@/lib/types";

// ----------------------------------------------------------------------------
// PinLoginProfile — Leverance B4: picker/pin-pad/velkomst kender kun dette
// lette format, uanset om kortene kommer fra forælderens RLS-hentede
// `profiles`-liste (fuldt udstyret) eller enheds-roster'en (kun det denne
// type kræver). `is_locked` erstatter et direkte blik på `pin_hash` — det
// er stadig kun et tilstedeværelses-tjek, aldrig hashen selv.
// ----------------------------------------------------------------------------

export interface PinLoginProfile {
  id: string;
  display_name: string;
  avatar: string | null;
  is_locked: boolean;
}

export function pinLoginProfileFromProfile(
  p: Pick<Profile, "id" | "display_name" | "avatar" | "pin_hash">,
): PinLoginProfile {
  return {
    id: p.id,
    display_name: p.display_name,
    avatar: p.avatar,
    is_locked: p.pin_hash !== null,
  };
}

export function pinLoginProfileFromRoster(entry: RosterEntry): PinLoginProfile {
  return {
    id: entry.profileId,
    display_name: entry.displayName,
    avatar: entry.avatar,
    is_locked: entry.hasPin,
  };
}

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

// ----------------------------------------------------------------------------
// child-signin — pin-verifikation + session-udstedelse (Leverance B2)
// ----------------------------------------------------------------------------

export interface ChildSigninCredentials {
  email: string;
  tokenHash: string;
  /** Altid "magiclink" i dag — sendt af serveren, ikke hardcodet her, så
   * en fremtidig ændring på serversiden ikke kræver en klient-antagelse. */
  otpType: string;
  displayName: string | null;
}

export interface ChildSigninOk extends ChildSigninCredentials {
  status: "ok";
}
/** "wrong" = forkert pin, intet aktivt rate limit lige nu. "rate_limited" = vent. */
export interface ChildSigninBlocked {
  status: "wrong" | "rate_limited";
  waitSeconds: number;
  attemptCount: number;
  askAdult: boolean;
}
export interface ChildSigninNotProvisioned {
  status: "not_provisioned";
}
export interface ChildSigninNetworkError {
  status: "network_error";
}
export type ChildSigninResult =
  | ChildSigninOk
  | ChildSigninBlocked
  | ChildSigninNotProvisioned
  | ChildSigninNetworkError;

interface ChildSigninErrorBody {
  error?: string;
  wait_seconds?: number;
  attempt_count?: number;
  ask_adult?: boolean;
  needs_provisioning?: boolean;
}

/**
 * Forsøg at logge barnet ind: verificerer pin-sekvensen (atomisk,
 * rate-limitet i databasen via attempt_child_pin) og — hvis den er
 * korrekt (eller profilen er ulåst) — beder om et engangs-login-token.
 * Fail-closed: enhver netværks-/parse-fejl behandles som "ingen adgang".
 *
 * `sequence` kan være tom for en profil klienten allerede ved er ulåst
 * (se `profile.pin_hash`) — serveren ignorerer indholdet i det tilfælde.
 */
export async function attemptChildSignin(
  profileId: string,
  sequence: readonly string[],
): Promise<ChildSigninResult> {
  try {
    const { data, error } = await supabase.functions.invoke("child-signin", {
      body: { profile_id: profileId, sequence: [...sequence] },
    });

    if (!error) {
      const res = data as {
        success?: boolean;
        email?: string;
        token_hash?: string;
        otp_type?: string;
        display_name?: string | null;
      } | null;
      if (res?.success && res.email && res.token_hash) {
        return {
          status: "ok",
          email: res.email,
          tokenHash: res.token_hash,
          otpType: res.otp_type ?? "magiclink",
          displayName: res.display_name ?? null,
        };
      }
      return { status: "network_error" };
    }

    if (!(error instanceof FunctionsHttpError)) {
      return { status: "network_error" };
    }

    let body: ChildSigninErrorBody = {};
    try {
      body = (await error.context.json()) as ChildSigninErrorBody;
    } catch {
      return { status: "network_error" };
    }

    if (body.needs_provisioning) {
      return { status: "not_provisioned" };
    }

    const httpStatus = error.context.status;
    const waitSeconds = body.wait_seconds ?? 0;
    const attemptCount = body.attempt_count ?? 0;
    const askAdult = body.ask_adult ?? false;

    if (httpStatus === 429) {
      return { status: "rate_limited", waitSeconds, attemptCount, askAdult };
    }
    if (httpStatus === 401) {
      return { status: "wrong", waitSeconds, attemptCount, askAdult };
    }
    return { status: "network_error" };
  } catch {
    return { status: "network_error" };
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
