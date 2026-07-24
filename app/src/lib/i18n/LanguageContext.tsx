/**
 * LanguageContext — voksnes (forælder/admin) sprogvalg som React-context.
 *
 * Scope (opstart-prompt-6, spor 3): dækker KUN forælder-/admin-træet under
 * ParentAuth.tsx (login/signup → Consent → Dashboard/VokabVaerksted/
 * HistorieVaerksted/OpretProfil). Børnevendt UI (spil, WorldMap, PinLogin,
 * ChildMode) og ErrorScreen kalder fortsat useT("da") direkte og er
 * UBERØRT — det er en separat, senere opgave (plan-boernesession-og-
 * dashboard.md, D3), som bruger profiles.ui_language, ikke denne context.
 *
 * Kun localStorage her (via languagePref.ts) — INGEN Supabase-afhængighed.
 * DB-synkronisering (accounts.ui_language) sker i useParentAuth.ts, som
 * ejer kontoen og kalder setLang ved login/skift. Denne fil kender
 * bevidst intet til Supabase, samme adskillelse som resten af i18n-laget.
 *
 * Selve context-objektet bor i languageContextObject.ts (ikke her) — en ren
 * .ts-fil, så denne .tsx-fil kun eksporterer komponenten (oxlint
 * react/only-export-components: Fast Refresh kræver rene komponent-filer).
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { dirFor, useT, type UiLanguage } from "./useT";
import { getLanguagePref, setLanguagePref } from "./languagePref";
import { LanguageContext, type LanguageContextValue } from "./languageContextObject";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>(() => getLanguagePref());
  const t = useT(lang);
  const dir = dirFor(lang);

  const setLang = useCallback((next: UiLanguage) => {
    setLangState(next);
    setLanguagePref(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, t, dir, setLang }),
    [lang, t, dir, setLang],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
