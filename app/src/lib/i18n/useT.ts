/**
 * useT — letvægts i18n-opslag (plan-platformsmodning.md §2.1).
 *
 * Bevidst IKKE en dot-path-streng-baseret oversætter (a la i18next) — her
 * returneres hele den typede ordbog, så `t.pinLogin.whoAreYou` fanges af
 * TypeScript hvis nøglen omdøbes eller fjernes. Ingen ekstern afhængighed.
 *
 * VOKSNES sprogvalg er bevidst UDSKUDT (ejer-beslutning 2026-07-23): kun
 * børneprofilernes `ui_language` bruges. Forælder-/admin-skærme kalder
 * `useT("da")` eksplicit indtil videre — se todo-note i README/handoff.
 */

import { ar } from "./ar";
import { da, type Dictionary } from "./da";

export type UiLanguage = "da" | "ar";

const dictionaries: Record<UiLanguage, Dictionary> = { da, ar };

/** Henter den typede ordbog for det ønskede sprog (default dansk). */
export function useT(lang: UiLanguage = "da"): Dictionary {
  return dictionaries[lang];
}

/** Tekstretning for det valgte UI-sprog — til den yderste skærm-container. */
export function dirFor(lang: UiLanguage): "ltr" | "rtl" {
  return lang === "ar" ? "rtl" : "ltr";
}
