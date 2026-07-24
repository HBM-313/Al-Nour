/**
 * useParentAuth — state-maskine for forælder-login/signup.
 *
 * Faser:
 *   checking_session → idle (form) → loading → idle (logget ind, via account)
 *                                            ↘ error (blив på formen)
 *                                            ↘ needs_confirmation (signup, e-mail skal bekræftes)
 *
 * Ved opstart tjekkes en evt. eksisterende session automatisk (returnerende
 * forælder skal ikke logge ind igen ved hvert besøg).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Account } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import {
  deleteOwnAccount,
  restoreSession,
  signInParent,
  signOutParent,
  signUpParent,
  updateAccountLanguage,
  verifyOwnPassword,
} from "./engine";

export type AuthMode = "login" | "signup";
export type AuthPhase = "checking_session" | "idle" | "loading" | "error" | "needs_confirmation";

export interface UseParentAuthArgs {
  onAuthenticated?: (account: Account) => void;
}

export function useParentAuth({ onAuthenticated }: UseParentAuthArgs = {}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [phase, setPhase] = useState<AuthPhase>("checking_session");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  /** true efter en vellykket kontosletning — viser en rolig afsluttende skærm i stedet for straks at falde tilbage til login-formularen. */
  const [justDeleted, setJustDeleted] = useState(false);
  const onAuthenticatedRef = useRef(onAuthenticated);
  onAuthenticatedRef.current = onAuthenticated;
  const { lang, t, setLang } = useLanguage();

  // Tjek en evt. eksisterende session ved opstart — kører kun én gang.
  // (setLang's reference er stabil på tværs af renders, så tilføjelsen af
  // den som dependency ændrer ikke "kør kun én gang"-opførslen.)
  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((acc) => {
      if (cancelled) return;
      if (acc) {
        setAccount(acc);
        setLang(acc.ui_language === "ar" ? "ar" : "da");
        onAuthenticatedRef.current?.(acc);
      }
      setPhase("idle");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAccount(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [setLang]);

  // Sprogskifteren bruges MENS der er en aktiv konto → persistér til DB.
  // (Rammer aldrig lige efter login/signup nedenfor, da submit selv sørger
  // for at lang og account.ui_language allerede stemmer overens der.)
  useEffect(() => {
    if (!account) return;
    if (account.ui_language === lang) return;
    let cancelled = false;
    void updateAccountLanguage(account.id, lang).then((updated) => {
      if (cancelled || !updated) return;
      setAccount((prev) => (prev && prev.id === updated.id ? updated : prev));
    });
    return () => {
      cancelled = true;
    };
  }, [account, lang]);

  const switchMode = useCallback((next: AuthMode) => {
    setMode(next);
    setPhase("idle");
    setErrorMessage(null);
  }, []);

  const submit = useCallback(
    async (email: string, password: string) => {
      setPhase("loading");
      setErrorMessage(null);

      const result =
        mode === "signup"
          ? await signUpParent(email, password, t.parentAuth)
          : await signInParent(email, password, t.parentAuth);

      if (!result.ok) {
        setPhase("error");
        setErrorMessage(result.error);
        return;
      }
      if (result.needsEmailConfirmation) {
        setPhase("needs_confirmation");
        return;
      }

      if (mode === "signup" && result.account.ui_language !== lang) {
        // Frisk konto: uden dette ville login-grenens "DB vinder" straks
        // have overskrevet det sprog forælderen lige valgte på selve
        // signup-skærmen med databasens default ('da'). Optimistisk lokalt;
        // DB-skrivningen sker i baggrunden (fail-soft, samme princip som
        // resten af sprog-synkroniseringen).
        setAccount({ ...result.account, ui_language: lang });
        void updateAccountLanguage(result.account.id, lang);
      } else {
        setAccount(result.account);
        setLang(result.account.ui_language === "ar" ? "ar" : "da");
      }
      setPhase("idle");
      onAuthenticatedRef.current?.(result.account);
    },
    [mode, t, lang, setLang],
  );

  const signOut = useCallback(async () => {
    await signOutParent();
    setAccount(null);
    setPhase("idle");
    setErrorMessage(null);
  }, []);

  /**
   * GDPR Art. 17: sletter kontoen for altid (Leverance 1.4). Kræver
   * adgangskode-genindtastning (ejer-beslutning) — verificeres FØR selve
   * RPC-kaldet, samme port-mønster som `app-shell`s forældre-gate.
   */
  const deleteAccount = useCallback(
    async (password: string): Promise<{ ok: boolean; error?: string }> => {
      const passwordOk = await verifyOwnPassword(password);
      if (!passwordOk) {
        return { ok: false, error: t.parentAuth.wrongPassword };
      }
      const res = await deleteOwnAccount(t.parentAuth);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      setAccount(null);
      setPhase("idle");
      setErrorMessage(null);
      setJustDeleted(true);
      return { ok: true };
    },
    [t],
  );

  const dismissFarewell = useCallback(() => setJustDeleted(false), []);

  return {
    mode,
    phase,
    errorMessage,
    account,
    justDeleted,
    switchMode,
    submit,
    signOut,
    updateAccount: setAccount,
    deleteAccount,
    dismissFarewell,
  };
}
