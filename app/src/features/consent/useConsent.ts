/**
 * useConsent — state-maskine for samtykke-indsendelse.
 *
 * Faser: idle → submitting → idle (givet, via onConsented) | error (bliv på formen)
 */

import { useCallback, useState } from "react";
import type { Account } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { giveConsent } from "./engine";

export type ConsentPhase = "idle" | "submitting" | "error";

export interface UseConsentArgs {
  onConsented?: (account: Account) => void;
}

export function useConsent({ onConsented }: UseConsentArgs = {}) {
  const [phase, setPhase] = useState<ConsentPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useLanguage();

  const submit = useCallback(
    async (accountId: string) => {
      setPhase("submitting");
      setErrorMessage(null);

      const updated = await giveConsent(accountId);
      if (!updated) {
        setPhase("error");
        setErrorMessage(t.consent.submitError);
        return;
      }
      setPhase("idle");
      onConsented?.(updated);
    },
    [onConsented, t],
  );

  return { phase, errorMessage, submit };
}
