/**
 * parent-auth — engine: supabase.auth (email/adgangskode) + ensure_parent_account().
 *
 * Signup-mekanisme er en RPC, ikke en trigger på auth.users (ejer-beslutning,
 * plan-samtykke-flow.md): ensure_parent_account() kaldes eksplicit efter
 * hvert login/signup, i stedet for at stole på en trigger på Supabases egen
 * interne auth.users-tabel — en fejlende trigger dér kunne i værste fald
 * blokere signup for ALLE brugere. role er hardcodet 'parent' inde i selve
 * RPC'en (fase1c_signup_rpc_rollebeskyttelse_access_token_hook.sql) og kan
 * ikke sættes eller ændres af klienten.
 *
 * MUREN: rører kun accounts (auth-identitet) — aldrig content/aqidah.
 */

import { supabase } from "@/lib/supabase";
import type { Account } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

export type AuthResult =
  | { ok: true; account: Account; needsEmailConfirmation: false }
  | { ok: true; account: null; needsEmailConfirmation: true }
  | { ok: false; error: string };

/** Oversatte beskeder — kaldestedet (useParentAuth.ts, som har `t` fra `useLanguage()`) leverer dem. */
export type ParentAuthMessages = Dictionary["parentAuth"];

/**
 * Oversætter Supabase/GoTrue's engelske fejlbeskeder til forståeligt dansk.
 * Matcher på indhold (ikke eksakt streng), da GoTrue's ordlyd kan ændre sig
 * på tværs af versioner.
 */
function mapAuthError(message: string, messages: ParentAuthMessages): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return messages.authWrongCredentials;
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return messages.authAlreadyRegistered;
  }
  if (m.includes("password") && (m.includes("least") || m.includes("short") || m.includes("weak"))) {
    return messages.authPasswordTooWeak;
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return messages.authRateLimited;
  }
  if (m.includes("email") && (m.includes("invalid") || m.includes("format"))) {
    return messages.authInvalidEmailFormat;
  }
  return messages.authGenericError;
}

/** Henter/opretter accounts-rækken for den nu-indloggede bruger. Fail-closed: null ved fejl. */
async function ensureAccount(): Promise<Account | null> {
  const { data, error } = await supabase.rpc("ensure_parent_account");
  if (error || !data) return null;
  return data as Account;
}

/**
 * Persisterer forælder/admin-sprogvalget (migration 20260724_accounts_
 * ui_language). Samme mønster som consent/engine.ts's giveConsent — dækket
 * af den eksisterende accounts_update_own-policy, ingen ny RPC nødvendig.
 * Fail-soft ved kaldestedet (useParentAuth.ts): en fejlet skrivning betyder
 * blot at valget forbliver enheds-lokalt (localStorage) til næste forsøg —
 * det blokerer aldrig selve sprogskiftet i UI'et.
 */
export async function updateAccountLanguage(
  accountId: string,
  language: "da" | "ar",
): Promise<Account | null> {
  const { data, error } = await supabase
    .from("accounts")
    .update({ ui_language: language })
    .eq("id", accountId)
    .select()
    .single();

  if (error || !data) return null;
  return data as Account;
}

export async function signUpParent(
  email: string,
  password: string,
  messages: ParentAuthMessages,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: mapAuthError(error.message, messages) };

    if (!data.session) {
      // E-mailbekræftelse er slået til for dette projekt — ingen session endnu,
      // og dermed intet auth.uid() at oprette en accounts-række under.
      return { ok: true, account: null, needsEmailConfirmation: true };
    }

    const account = await ensureAccount();
    if (!account) {
      return {
        ok: false,
        error: messages.accountSetupFailed,
      };
    }
    return { ok: true, account, needsEmailConfirmation: false };
  } catch {
    return { ok: false, error: messages.connectionError };
  }
}

export async function signInParent(
  email: string,
  password: string,
  messages: ParentAuthMessages,
): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: mapAuthError(error.message, messages) };
    if (!data.session) {
      return { ok: false, error: messages.loginFailed };
    }

    const account = await ensureAccount();
    if (!account) {
      return { ok: false, error: messages.accountFetchFailed };
    }
    return { ok: true, account, needsEmailConfirmation: false };
  } catch {
    return { ok: false, error: messages.connectionError };
  }
}

export async function signOutParent(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Bekræfter adgangskoden for den ALLEREDE indloggede forælder
 * (signInWithPassword mod sessionens egen e-mail). Bruges som port foran
 * kontosletning (ejer-beslutning: adgangskode kræves, se Leverance 1.4).
 * Denne funktion kaldes KUN fra "parent"-visningen, hvor en rigtig
 * forælder-session er garanteret (nået via ParentAuth-login eller
 * app-shell's parent_gate) — modsat den brede forældre-port i
 * `app-shell/useAppShell.ts`s `submitGate`, som (siden Leverance B2) skal
 * virke uanset hvilken identitet der måtte være aktiv, og derfor gør en
 * FULD e-mail+adgangskode-reautentificering i stedet for kun dette.
 * Fail-closed: mangler sessionen/e-mailen, eller fejler kaldet, er svaret nej.
 */
export async function verifyOwnPassword(password: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email;
    if (!email) return false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  } catch {
    return false;
  }
}

/**
 * GDPR Art. 17 — forælderen sletter sin egen konto (Leverance 1.4).
 * Kalder `delete_own_account()`-RPC'en (SECURITY DEFINER, rører
 * udelukkende `auth.uid()`s egen konto — ingen parameter, ingen
 * klient-valgt id). Cascade i databasen rydder alle børneprofiler, alt
 * fremskridt og klasse-medlemskab i samme kald. Øjeblikkelig, ingen
 * fortrydelsesperiode (ejer-beslutning). Ved succes ryddes klient-
 * sessionen eksplicit, da den nu-slettede brugers token ellers kan blive
 * siddende i browserens storage indtil det udløber.
 */
export async function deleteOwnAccount(
  messages: ParentAuthMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      return {
        ok: false,
        error: messages.deleteAccountFailed,
      };
    }
    await supabase.auth.signOut();
    return { ok: true };
  } catch {
    return { ok: false, error: messages.connectionError };
  }
}

/** Henter en evt. eksisterende session + sikrer accounts-rækken. Bruges ved opstart. */
export async function restoreSession(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return ensureAccount();
}
