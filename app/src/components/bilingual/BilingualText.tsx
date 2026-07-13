/**
 * Bilingual building blocks — the RTL/LTR foundation.
 *
 * Rule (from SKILL.md): dir is handled per text block, never globally.
 * The document stays LTR (Danish is dominant); every piece of Arabic gets
 * its own dir="rtl" island. This makes mixed-direction layouts (a Danish
 * sentence with an embedded Arabic word) behave correctly by construction.
 */

import type { ReactNode } from "react";

type ArabicRegister = "fusha" | "everyday";

/** Block-level Arabic text: its own RTL island with correct font/leading. */
export function ArabicBlock({
  children,
  register = "fusha",
  className = "",
}: {
  children: ReactNode;
  /** fusha = Quran/religiøst sprog (viol), everyday = hverdagsarabisk (grøn) */
  register?: ArabicRegister;
  className?: string;
}) {
  return (
    <p
      dir="rtl"
      lang="ar"
      className={`arabic arabic-${register} text-2xl ${className}`}
    >
      {children}
    </p>
  );
}

/** Inline Arabic inside a Danish sentence — isolates bidi correctly. */
export function ArabicInline({
  children,
  register = "everyday",
}: {
  children: ReactNode;
  register?: ArabicRegister;
}) {
  return (
    <span dir="rtl" lang="ar" className={`arabic arabic-${register}`}>
      {children}
    </span>
  );
}

/**
 * A full vocabulary unit: Arabic + optional transliteration + Danish.
 * Transliteration visibility follows the child's level/profile setting —
 * pass show from the profile, don't decide locally.
 */
export function VocabUnit({
  arabic,
  transliteration,
  danish,
  register = "everyday",
  showTransliteration,
}: {
  arabic: string;
  transliteration?: string | null;
  danish: string;
  register?: ArabicRegister;
  showTransliteration: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <ArabicBlock register={register} className="text-4xl">
        {arabic}
      </ArabicBlock>
      {showTransliteration && transliteration ? (
        <span className="transliteration text-sm">{transliteration}</span>
      ) : null}
      <span dir="ltr" lang="da" className="font-semibold">
        {danish}
      </span>
    </div>
  );
}
