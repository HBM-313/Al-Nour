/**
 * Opret barneprofil — engine (Leverance C, plan-samtykke-flow.md).
 *
 * Dataminimering: en børneprofil er KUN kaldenavn + fødselsår + avatar
 * (+ stemme og valgfri dyre-pin). Intet andet felt må tilføjes her.
 *
 * Sikkerhed:
 * - INSERT går gennem RLS-policyen `profiles_owner_all` (owner_account_id
 *   = auth.uid()) — en forælder kan kun oprette profiler til sig selv.
 * - Pin sættes UDELUKKENDE via SECURITY DEFINER-RPC'en set_child_pin
 *   (genbrugt fra features/pin-login/engine.ts). Aldrig direkte
 *   kolonneskrivning; klartekst-pin findes aldrig i databasen.
 */

import { supabase } from "@/lib/supabase";
import type { Profile, VoicePref } from "@/lib/types";
import { setPin } from "@/features/pin-login";

/**
 * Avatar-pool (ejer-beslutning 2026-07-19: emoji nu, frit udskiftelig når
 * illustrationsstilen besluttes — `profiles.avatar` er text, så skiftet
 * kræver ingen migration). Bevidst INGEN overlap med pin-login's
 * ANIMAL_POOL, så avatar og dyre-kode aldrig kan forveksles.
 */
export const AVATAR_POOL = [
  "🦄",
  "🚀",
  "🌟",
  "🌙",
  "🌈",
  "🦋",
  "🐬",
  "🐥",
  "⚽",
  "🎨",
  "📚",
  "🪁",
] as const;

/** Pin-længde: 3–4 dyr, samme kontrakt som testprofilerne (Ali 3, Zainab 4). */
export const PIN_MIN = 3;
export const PIN_MAX = 4;

/** Målgruppen er 3–14 år; DB-constrainten tillader op til 18 år tilbage. */
export const MIN_AGE = 3;
export const MAX_AGE = 14;

/** Fødselsår-valg, nyeste først (3-årig → 14-årig). */
export function birthYearOptions(now = new Date()): number[] {
  const thisYear = now.getFullYear();
  const years: number[] = [];
  for (let y = thisYear - MIN_AGE; y >= thisYear - MAX_AGE; y--) years.push(y);
  return years;
}

export function ageOf(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

export interface NewChildProfile {
  displayName: string;
  birthYear: number;
  avatar: string;
  preferredVoice: VoicePref;
  /** Pool-index-sekvens (som strenge, jf. set_child_pin-kontrakten) — tom = ingen pin. */
  pinSequence: readonly string[];
}

export type CreateResult =
  | { ok: true; profile: Profile; pinWarning?: string }
  | { ok: false; error: string };

/** Oversatte fejlbeskeder — kaldestedet (useOpretProfil.ts) leverer dem fra useT("da"). */
export interface OpretProfilMessages {
  emptyName: string;
  pinSaveFailed: string;
  errorGeneric: string;
  errorRls: string;
  errorBirthYear: string;
  errorNetwork: string;
  errorFallback: string;
}

/**
 * Opret profilen og sæt derefter evt. pin. To trin fordi pin-hashing bor i
 * databasen (set_child_pin) og aldrig må efterlignes client-side.
 *
 * Fejler pin-trinnet EFTER at profilen er oprettet, beholdes profilen
 * (ulåst) og der returneres en advarsel — forælderen kan sætte koden igen
 * senere. Det er bedre end at slette en netop oprettet profil bag om
 * ryggen på forælderen.
 */
export async function createChildProfile(
  ownerAccountId: string,
  input: NewChildProfile,
  messages: OpretProfilMessages,
): Promise<CreateResult> {
  const displayName = input.displayName.trim();
  if (!displayName) return { ok: false, error: messages.emptyName };

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      owner_account_id: ownerAccountId,
      display_name: displayName,
      birth_year: input.birthYear,
      avatar: input.avatar,
      preferred_voice: input.preferredVoice,
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: translateInsertError(error?.message, messages) };
  }
  const profile = data as Profile;

  if (input.pinSequence.length >= PIN_MIN) {
    const pinResult = await setPin(profile.id, input.pinSequence);
    if (!pinResult.ok) {
      return {
        ok: true,
        profile,
        pinWarning: messages.pinSaveFailed,
      };
    }
    // Afspejl at pin nu er sat, uden ekstra fetch (hashen sendes aldrig til klienten).
    return { ok: true, profile: { ...profile, pin_hash: "set" } };
  }

  return { ok: true, profile };
}

/** Oversæt de mest sandsynlige Postgres/RLS-fejl til forældre-venligt sprog. */
function translateInsertError(message: string | undefined, messages: OpretProfilMessages): string {
  if (!message) return messages.errorGeneric;
  const m = message.toLowerCase();
  if (m.includes("row-level security")) {
    return messages.errorRls;
  }
  if (m.includes("birth_year")) {
    return messages.errorBirthYear;
  }
  if (m.includes("fetch") || m.includes("network")) {
    return messages.errorNetwork;
  }
  return messages.errorFallback;
}
