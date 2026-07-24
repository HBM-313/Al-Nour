import { createContext } from "react";
import type { Dictionary } from "./da";
import type { UiLanguage } from "./useT";

export interface LanguageContextValue {
  lang: UiLanguage;
  t: Dictionary;
  dir: "ltr" | "rtl";
  /** Skifter sprog — opdaterer context + huskes på enheden med det samme. */
  setLang: (lang: UiLanguage) => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);
