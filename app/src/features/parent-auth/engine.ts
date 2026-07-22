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

export type AuthResult =
  | { ok: true; account: Account; needsEmailConfirmation: false }
  | { ok: true; account: null; needsEmailConfirmation: true }
  | { ok: false; error: string };

/**
 * Oversætter Supabase/GoTrue's engelske fejlbeskeder til forståeligt dansk.
 * Matcher på indhold (ikke eksakt streng), da GoTrue's ordlyd kan ændre sig
 * på tværs af versioner.
 */
function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Forkert e-mail eller adgangskode.";
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return "Denne e-mail er allerede registreret. Prøv at logge ind i stedet.";
  }
  if (m.includes("password") && (m.includes("least") || m.includes("short") || m.includes("weak"))) {
    return "Adgangskoden er for kort eller for simpel. Prøv mindst 8 tegn.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "For mange forsøg lige nu — vent et øjeblik og prøv igen.";
  }
  if (m.includes("email") && (m.includes("invalid") || m.includes("format"))) {
    return "Denne e-mailadresse ser ikke gyldig ud.";
  }
  return "Der skete en fejl. Prøv igen om lidt.";
}

/** Henter/opretter accounts-rækken for den nu-indloggede bruger. Fail-closed: null ved fejl. */
async function ensureAccount(): Promise<Account | null> {
  const { data, error } = await supabase.rpc("ensure_parent_account");
  if (error || !data) return null;
  return data as Account;
}

export async function signUpParent(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: mapAuthError(error.message) };

    if (!data.session) {
      // E-mailbekræftelse er slået til for dette projekt — ingen session endnu,
      // og dermed intet auth.uid() at oprette en accounts-række under.
      return { ok: true, account: null, needsEmailConfirmation: true };
    }

    const account = await ensureAccount();
    if (!account) {
      return {
        ok: false,
        error: "Kontoen blev oprettet, men kunne ikke sættes op. Prøv at logge ind igen.",
      };
    }
    return { ok: true, account, needsEmailConfirmation: false };
  } catch {
    return { ok: false, error: "Kunne ikke oprette forbindelse. Tjek din internetforbindelse." };
  }
}

export async function signInParent(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: mapAuthError(error.message) };
    if (!data.session) {
      return { ok: false, error: "Login lykkedes ikke. Prøv igen." };
    }

    const account = await ensureAccount();
    if (!account) {
      return { ok: false, error: "Kunne ikke hente din konto. Prøv igen." };
    }
    return { ok: true, account, needsEmailConfirmation: false };
  } catch {
    return { ok: false, error: "Kunne ikke oprette forbindelse. Tjek din internetforbindelse." };
  }
}

export async function signOutParent(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Bekræfter adgangskoden for den ALLEREDE indloggede forælder — samme
 * genbrugs-mønster som `app-shell/engine.ts`s `verifyParentPassword`
 * (signInWithPassword mod sessionens egen e-mail). Bruges som port foran
 * kontosletning (ejer-beslutning: adgangskode kræves, se Leverance 1.4).
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
export async function deleteOwnAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) {
      return {
        ok: false,
        error: "Kontoen kunne ikke slettes. Prøv igen, eller kontakt os hvis det gentager sig.",
      };
    }
    await supabase.auth.signOut();
    return { ok: true };
  } catch {
    return { ok: false, error: "Kunne ikke oprette forbindelse. Tjek din internetforbindelse." };
  }
}

/** Henter en evt. eksisterende session + sikrer accounts-rækken. Bruges ved opstart. */
export async function restoreSession(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return ensureAccount();
}
