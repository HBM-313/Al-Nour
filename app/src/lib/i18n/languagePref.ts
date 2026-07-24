/**
 * languagePref — voksnes (forælder/admin) UI-sprog, huskt på ENHEDEN.
 *
 * Ejer-beslutning (2026-07-24): sprogskifteren skal være synlig hele vejen,
 * også FØR login — der findes ingen konto endnu at læse/skrive et sprog
 * på, så indtil login huskes valget kun lokalt (samme fail-soft mønster
 * som voicePref.ts). Ved login synkroniseres kontoens ui_language IND
 * (databasen vinder, jf. LanguageContext.tsx) — så en forælder der logger
 * ind på en ny enhed altid får sit gemte sprog, ikke enhedens forvalg.
 *
 * Rører KUN localStorage — ingen Supabase-afhængighed her (den hører til
 * i useParentAuth.ts, som ejer kontoen).
 */

import type { UiLanguage } from "./useT";

const KEY = "nour_adult_lang_v1";

export function getLanguagePref(): UiLanguage {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "ar" ? "ar" : "da";
  } catch {
    return "da";
  }
}

export function setLanguagePref(lang: UiLanguage): void {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // Uden lager gælder valget kun indeværende sidevisning.
  }
}
