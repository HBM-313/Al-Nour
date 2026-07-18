/**
 * consent — engine: registrerer forældresamtykke på accounts-rækken
 * (plan-samtykke-flow.md, leverance B).
 *
 * update accounts set consent_given_at = now(), consent_version = CONSENT_VERSION
 * where id = auth.uid() — dækket af den eksisterende accounts_update_own-policy.
 * trg_accounts_protect_role rører kun role/id, så de to samtykke-felter er
 * upåvirket af rolle-beskyttelsen (verificeret mod live-DB med en mur-stil
 * regressionstest, rullet tilbage, 2026-07-19: forælder kunne opdatere egne
 * consent-felter ✓, rolle-eskalering forblev blokeret ✓).
 *
 * MUREN: rører kun accounts (auth-identitet/GDPR-samtykke) — aldrig content/aqidah.
 */

import { supabase } from "@/lib/supabase";
import type { Account } from "@/lib/types";

/** Skal matche versionen der vises i samtykketeksten i Consent.tsx præcis. */
export const CONSENT_VERSION = "v1-2026-07";

/** Fail-closed: returnerer null ved fejl, sætter aldrig samtykke "halvt". */
export async function giveConsent(accountId: string): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .update({
      consent_given_at: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
    })
    .eq("id", accountId)
    .select()
    .single();

  if (error || !data) return null;
  return data as Account;
}
