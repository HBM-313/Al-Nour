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
import {
  deleteOwnAccount,
  restoreSession,
  signInParent,
  signOutParent,
  signUpParent,
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

  // Tjek en evt. eksisterende session ved opstart — kører kun én gang.
  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((acc) => {
      if (cancelled) return;
      if (acc) {
        setAccount(acc);
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
  }, []);

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
        mode === "signup" ? await signUpParent(email, password) : await signInParent(email, password);

      if (!result.ok) {
        setPhase("error");
        setErrorMessage(result.error);
        return;
      }
      if (result.needsEmailConfirmation) {
        setPhase("needs_confirmation");
        return;
      }
      setAccount(result.account);
      setPhase("idle");
      onAuthenticatedRef.current?.(result.account);
    },
    [mode],
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
        return { ok: false, error: "Forkert adgangskode." };
      }
      const res = await deleteOwnAccount();
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      setAccount(null);
      setPhase("idle");
      setErrorMessage(null);
      setJustDeleted(true);
      return { ok: true };
    },
    [],
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
