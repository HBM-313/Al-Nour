/**
 * usePinLogin — state-maskine for profilvælger → pin-skærm → velkomst.
 *
 * Flow (design godkendt i plan-pin-login-port.md):
 *   1. picker  — vælg hvilket barn (avatar-cirkler)
 *   2. pin     — dyre-grid, fylder lys-pladser op idet barnet trykker
 *   3. welcome — kort bekræftelse, derefter onLoggedIn(profile)
 *
 * Profil UDEN pin_hash logger direkte ind (trin "pin" springes over) —
 * pin er en valgfri lås forælderen kan slå til.
 *
 * Forkert kode: blid nulstilling, ALDRIG straf. Efter ADULT_HELP_THRESHOLD
 * fejl i træk vises "prøv igen sammen med en voksen" — aldrig lockout af
 * barnet alene (ejer-beslutning, plan-pin-login-port.md).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/types";
import { ADULT_HELP_THRESHOLD, verifyPin } from "./engine";

/** Korteste/længste gyldige pin i UI'et. Testkoder: Ali=3, Zainab=4. */
const MIN_PIN_LEN = 3;
const MAX_PIN_LEN = 6;

export type PinLoginPhase = "picker" | "pin" | "welcome";

export interface UsePinLoginArgs {
  onLoggedIn: (profile: Profile) => void;
}

export function usePinLogin({ onLoggedIn }: UsePinLoginArgs) {
  const [phase, setPhase] = useState<PinLoginPhase>("picker");
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [entered, setEntered] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "checking" | "wrong" | "network_error">(
    "idle",
  );
  const [failCount, setFailCount] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const chooseProfile = useCallback(
    (profile: Profile) => {
      setActiveProfile(profile);
      setEntered([]);
      setStatus("idle");
      setFailCount(0);
      if (!profile.pin_hash) {
        // Intet pin sat — profilen er ulåst, log direkte ind.
        setPhase("welcome");
        onLoggedIn(profile);
        return;
      }
      setPhase("pin");
    },
    [onLoggedIn],
  );

  const backToPicker = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPhase("picker");
    setActiveProfile(null);
    setEntered([]);
    setStatus("idle");
    setFailCount(0);
  }, []);

  /**
   * Tjek det aktuelle forsøg mod databasen. Kaldes automatisk efter hvert
   * tryk (fra og med MIN_PIN_LEN dyr) — men da vi ikke kender den korrekte
   * pins længde uden at kende hashen (den forlader aldrig DB'en), tjekker
   * vi optimistisk ved hver ny længde. Et forkert MELLEM-resultat viser
   * ALDRIG "forkert" til barnet — det ville straffe et barn der bare ikke
   * er færdig med en 4+-dyrs-pin endnu. Kun ved MAX_PIN_LEN uden match
   * tælles det som et rigtigt forkert forsøg.
   */
  const checkAttempt = useCallback(
    async (profile: Profile, sequence: readonly string[], isFinal: boolean) => {
      setStatus("checking");
      const result = await verifyPin(profile.id, sequence);

      if (result === "correct") {
        setStatus("idle");
        setPhase("welcome");
        onLoggedIn(profile);
        return;
      }

      if (result === "network_error") {
        setStatus("network_error");
        resetTimer.current = setTimeout(() => {
          setEntered([]);
          setStatus("idle");
        }, 900);
        return;
      }

      // "incorrect" ved en ikke-endelig længde: barnet er sandsynligvis
      // bare ikke færdig endnu (fx 3 af 4 dyr). Vis intet — vent på næste tryk.
      if (!isFinal) {
        setStatus("idle");
        return;
      }

      setStatus("wrong");
      setFailCount((n) => n + 1);
      resetTimer.current = setTimeout(() => {
        setEntered([]);
        setStatus("idle");
      }, 800);
    },
    [onLoggedIn],
  );

  const pressAnimal = useCallback(
    (poolIndex: number) => {
      if (!activeProfile || status === "checking") return;
      const next = [...entered, String(poolIndex)];
      setEntered(next);

      if (next.length < MIN_PIN_LEN) return;
      void checkAttempt(activeProfile, next, next.length >= MAX_PIN_LEN);
    },
    [activeProfile, entered, status, checkAttempt],
  );

  const needsAdultHelp = failCount >= ADULT_HELP_THRESHOLD;

  return {
    phase,
    activeProfile,
    entered,
    status,
    needsAdultHelp,
    chooseProfile,
    pressAnimal,
    backToPicker,
  };
}
