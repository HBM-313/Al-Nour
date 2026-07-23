/**
 * usePinLogin — state-maskine for profilvælger → pin-skærm → velkomst.
 *
 * Flow (design godkendt i plan-pin-login-port.md, opdateret Leverance B2
 * — plan-boernesession-og-dashboard.md del 4):
 *   1. picker  — vælg hvilket barn (avatar-cirkler)
 *   2. pin     — dyre-grid, fylder lys-pladser op idet barnet trykker
 *   3. welcome — kort bekræftelse, derefter onLoggedIn(profile, session)
 *
 * Profil UDEN pin_hash logger direkte ind (trin "pin" springes helt over)
 * — pin er en valgfri lås forælderen kan slå til. Klienten kender dette
 * fra den RLS-hentede profil (`profile.pin_hash`), IKKE fra en gættelig
 * server-oracle.
 *
 * DEBOUNCE, IKKE "tjek ved hvert tryk" (ændret i B2): før B2 var der intet
 * rate limit, så koden kunne trygt spørge serveren ved HVER ny længde
 * (optimistisk, uden at kende den rigtige pin-længde). Med et rigtigt
 * rate limit (attempt_child_pin) ville det bruge budgettet op på ren
 * "ikke færdig endnu"-støj. I stedet: et forsøg sendes først når barnet
 * enten (a) rammer MAX_PIN_LEN, eller (b) holder pause i DEBOUNCE_MS uden
 * nyt tryk. Det er samme UX-mønster som almindelige PIN-tastaturer.
 *
 * Forkert kode: blid nulstilling, ALDRIG straf. Serveren styrer selv den
 * stigende forsinkelse (aldrig lockout) — "hent en voksen" vises når
 * serveren siger askAdult=true (attempt_count ≥ 5), ikke en lokal tæller.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import {
  attemptChildSignin,
  type ChildSigninCredentials,
} from "./engine";

const MIN_PIN_LEN = 3;
const MAX_PIN_LEN = 6;
/** Pause uden nyt tryk før et forsøg sendes som "færdigt". */
const DEBOUNCE_MS = 550;

export type PinLoginPhase = "picker" | "pin" | "welcome";
export type PinLoginStatus =
  | "idle"
  | "checking"
  | "wrong"
  | "rate_limited"
  | "network_error"
  | "not_provisioned";

export interface UsePinLoginArgs {
  /**
   * Kaldes når pin'en er bekræftet af serveren. Selve session-skiftet
   * (signOut af forælderen → verifyOtp som barnet) ejes af app-skallen,
   * IKKE af denne hook — den returnerer om skiftet lykkedes, så vi kan
   * vise en fejl i stedet for at gå videre til "welcome" hvis det fejlede
   * (sjældent: fx tabt netværk i det præcise øjeblik).
   */
  onLoggedIn: (
    profile: Profile,
    credentials: ChildSigninCredentials,
  ) => Promise<boolean>;
}

export function usePinLogin({ onLoggedIn }: UsePinLoginArgs) {
  const [phase, setPhase] = useState<PinLoginPhase>("picker");
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [entered, setEntered] = useState<string[]>([]);
  const [status, setStatus] = useState<PinLoginStatus>("idle");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [askAdult, setAskAdult] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    debounceTimer.current = null;
    resetTimer.current = null;
    countdownTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const backToPicker = useCallback(() => {
    clearTimers();
    setPhase("picker");
    setActiveProfile(null);
    setEntered([]);
    setStatus("idle");
    setWaitSeconds(0);
    setAskAdult(false);
  }, [clearTimers]);

  /** Kør selve serverkaldet og reager på resultatet. */
  const runAttempt = useCallback(
    async (profile: Profile, sequence: readonly string[]) => {
      setStatus("checking");
      const result = await attemptChildSignin(profile.id, sequence);

      if (result.status === "ok") {
        const loggedIn = await onLoggedIn(profile, result);
        if (!loggedIn) {
          // Sjælden race: pin var korrekt, men selve session-skiftet
          // fejlede (fx netværk droppet mellem de to trin). Fail-closed,
          // lad barnet prøve igen frem for at foregive succes.
          setStatus("network_error");
          setEntered([]);
          return;
        }
        setStatus("idle");
        setPhase("welcome");
        return;
      }

      if (result.status === "not_provisioned") {
        setStatus("not_provisioned");
        return;
      }

      if (result.status === "network_error") {
        setStatus("network_error");
        setEntered([]);
        return;
      }

      // "wrong" eller "rate_limited"
      setAskAdult(result.askAdult);
      setWaitSeconds(result.waitSeconds);

      if (result.status === "rate_limited" && result.waitSeconds > 0) {
        setStatus("rate_limited");
        countdownTimer.current = setInterval(() => {
          setWaitSeconds((s) => {
            if (s <= 1) {
              if (countdownTimer.current) clearInterval(countdownTimer.current);
              setStatus("idle");
              setEntered([]);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
        return;
      }

      setStatus("wrong");
      resetTimer.current = setTimeout(() => {
        setEntered([]);
        setStatus("idle");
      }, 900);
    },
    [onLoggedIn],
  );

  const chooseProfile = useCallback(
    (profile: Profile) => {
      clearTimers();
      setActiveProfile(profile);
      setEntered([]);
      setStatus("idle");
      setWaitSeconds(0);
      setAskAdult(false);

      if (!profile.pin_hash) {
        // Ulåst profil (kendt fra den RLS-hentede profil, ikke gættet) —
        // log direkte ind. Sekvensen er tom; serveren ignorerer den, da
        // der ikke er noget pin at matche mod.
        void runAttempt(profile, []);
        return;
      }
      setPhase("pin");
    },
    [clearTimers, runAttempt],
  );

  const pressAnimal = useCallback(
    (poolIndex: number) => {
      if (!activeProfile || status === "checking" || status === "rate_limited") return;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setStatus("idle");

      const next = [...entered, String(poolIndex)];
      setEntered(next);
      if (next.length < MIN_PIN_LEN) return;

      if (next.length >= MAX_PIN_LEN) {
        void runAttempt(activeProfile, next);
        return;
      }

      // Vent på en kort pause, før vi bruger et af de begrænsede forsøg —
      // barnet er måske ikke færdig med at taste endnu.
      debounceTimer.current = setTimeout(() => {
        void runAttempt(activeProfile, next);
      }, DEBOUNCE_MS);
    },
    [activeProfile, entered, status, runAttempt],
  );

  const needsAdultHelp = askAdult && (status === "wrong" || status === "rate_limited");

  return {
    phase,
    activeProfile,
    entered,
    status,
    waitSeconds,
    needsAdultHelp,
    chooseProfile,
    pressAnimal,
    backToPicker,
  };
}
