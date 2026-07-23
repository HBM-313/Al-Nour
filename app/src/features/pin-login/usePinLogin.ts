/**
 * usePinLogin — state-maskine for profilvælger → pin-skærm → velkomst.
 *
 * Flow (design godkendt i plan-pin-login-port.md, opdateret Leverance B2
 * — plan-boernesession-og-dashboard.md del 4):
 *   1. picker  — vælg hvilket barn (avatar-cirkler)
 *   2. pin     — dyre-grid, fylder lys-pladser op idet barnet trykker
 *   3. welcome — kort bekræftelse, derefter onLoggedIn(profileId, session)
 *
 * Ulåst profil (`is_locked: false`) logger direkte ind (trin "pin"
 * springes helt over) — pin er en valgfri lås forælderen kan slå til.
 * Klienten kender dette fra `PinLoginProfile.is_locked`, som enten kommer
 * fra den RLS-hentede profil (`pin_hash !== null`) eller fra enheds-
 * roster'en (Leverance B4) — aldrig fra en gættelig server-oracle.
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
import {
  attemptChildSignin,
  type ChildSigninCredentials,
  type PinLoginProfile,
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
   * Kaldes når pin'en er bekræftet af serveren, med profilens id (IKKE det
   * fulde objekt — app-skallen henter den kanoniske profil frisk under
   * barnets egen session bagefter, se useAppShell.completeChildSignin;
   * det er nødvendigt uanset kilde, men især når kortet kom fra
   * enheds-roster'en, som ikke kender fx fødselsår eller stemmevalg).
   * Selve session-skiftet (signOut af forælderen → verifyOtp som barnet)
   * ejes af app-skallen, IKKE af denne hook — den returnerer om skiftet
   * lykkedes, så vi kan vise en fejl i stedet for at gå videre til
   * "welcome" hvis det fejlede (sjældent: fx tabt netværk i det præcise
   * øjeblik).
   */
  onLoggedIn: (
    profileId: string,
    credentials: ChildSigninCredentials,
  ) => Promise<boolean>;
}

export function usePinLogin({ onLoggedIn }: UsePinLoginArgs) {
  const [phase, setPhase] = useState<PinLoginPhase>("picker");
  const [activeProfile, setActiveProfile] = useState<PinLoginProfile | null>(null);
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
    async (profile: PinLoginProfile, sequence: readonly string[]) => {
      setStatus("checking");
      const result = await attemptChildSignin(profile.id, sequence);

      if (result.status === "ok") {
        const loggedIn = await onLoggedIn(profile.id, result);
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

      if (sequence.length === 0) {
        // Roster'en (Leverance B4) troede profilen var ulåst, men
        // serveren siger noget andet — en forælder har sat et pin siden
        // sidste login på denne enhed. Vis pin-skærmen (vi er stadig i
        // "picker"-fasen her, hvor feedback slet ikke ville være synlig)
        // fremfor et dødt "prøv igen" på en kode der aldrig blev tastet.
        setPhase("pin");
        if (result.status === "wrong") {
          setStatus("idle");
          return;
        }
        // "rate_limited": fald igennem til den almindelige håndtering
        // nedenfor, nu synlig i pin-skærmen i stedet for profilvælgeren.
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
    (profile: PinLoginProfile) => {
      clearTimers();
      setActiveProfile(profile);
      setEntered([]);
      setStatus("idle");
      setWaitSeconds(0);
      setAskAdult(false);

      if (!profile.is_locked) {
        // Ulåst profil (kendt fra den RLS-hentede profil eller roster'en,
        // ikke gættet) — log direkte ind. Sekvensen er tom; serveren
        // ignorerer den, da der ikke er noget pin at matche mod.
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
