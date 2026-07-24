/**
 * LanguageSwitcher — DA/AR-skifter for hele forælder-/admin-træet.
 *
 * Ejer-godkendt demo (nour-sprogskifter-demo.html, 2026-07-24): synlig
 * hele vejen (login/signup OG portal), øverst i scenen. Ren presentation —
 * al tilstand kommer fra useLanguage() (LanguageContext.tsx).
 */

import { useLanguage } from "@/lib/i18n";
import type { UiLanguage } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, t, setLang } = useLanguage();

  return (
    <div
      className="lang-switcher relative z-10 mb-3 flex justify-end gap-1"
      role="group"
      aria-label={t.common.switcherAriaLabel}
    >
      <LangButton code="da" active={lang === "da"} onPick={setLang} />
      <LangButton code="ar" active={lang === "ar"} onPick={setLang} />
    </div>
  );
}

function LangButton({
  code,
  active,
  onPick,
}: {
  code: UiLanguage;
  active: boolean;
  onPick: (lang: UiLanguage) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`lang-btn rounded-full px-3 py-1 text-xs font-bold ${active ? "lang-btn-on" : "auth-ghost"}`}
      onClick={() => onPick(code)}
    >
      {code.toUpperCase()}
    </button>
  );
}
