import { useContext } from "react";
import { LanguageContext, type LanguageContextValue } from "./languageContextObject";

/** Voksnes sprogvalg (lang/t/dir/setLang) — skal bruges inden i <LanguageProvider>. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage() skal kaldes inden i <LanguageProvider>.");
  }
  return ctx;
}
