/**
 * Ordforråds-værkstedet — engine (Leverance C, milepæl "Ordforråds-værkstedet").
 *
 * Adgang: KUN admin/editor kan skrive (RLS `vocabulary_write_admin_editor`,
 * fail-closed claim-mønster). UI'et viser kun fanen for de roller, men det
 * er databasen der håndhæver adgangen — aldrig UI'et.
 *
 * MUREN i denne feature:
 *  - AI-forslag kommer fra Edge Function `suggest-vocab`, der KUN returnerer
 *    forslag — den skriver aldrig selv i databasen.
 *  - `insertDraft` hardcoder `is_published: false`. AI-foreslåede ord kan
 *    ikke fødes udgivne — det håndhæves også i DB af triggeren
 *    `trg_vocab_ai_draft_only` (defense-in-depth).
 *  - Udgivelse er en separat, menneskelig handling (`setPublished`).
 *
 * Dublet-værn i tre lag (ejer-krav):
 *  1. Edge Function: sender eksisterende ord med i prompten OG efter-filtrerer
 *     Claudes svar med normaliseret sammenligning.
 *  2. Klienten: filtrerer forslag mod den indlæste ordliste (denne fil).
 *  3. Databasen: `vocabulary_word_ar_key` (UNIQUE) er sidste mur.
 */

import { supabase } from "@/lib/supabase";
import type { Letter, VocabularyWord } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

/** Oversatte beskeder — kaldestedet (useVokabVaerksted.ts, som har `t` fra `useLanguage()`) leverer dem. */
export type VokabVaerkstedMessages = Dictionary["vokabVaerksted"];

/** Spejler DB-CHECK'en `vocabulary_category_check` — udvides kun via migration. */
export const VOCAB_CATEGORIES = [
  "familie",
  "tal",
  "farver",
  "dyr",
  "mad",
  "krop",
  "hjem",
  "natur",
  "hilsner",
] as const;
export type VocabCategory = (typeof VOCAB_CATEGORIES)[number];

/**
 * Normalisér et arabisk ord til dublet-sammenligning:
 * strip harakat/tatweel og fold hamza-bærere til grundbogstavet.
 * Samme konvention som seed-koblingen i live-DB (أُمّ ≙ ام).
 */
export function normalizeArabic(word: string): string {
  return (word ?? "")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/ة$/g, "ه")
    .trim();
}

export function hasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s ?? "");
}

/**
 * Find det bogstav (fra `letters`) et ord kobles til via sit første tegn.
 * Returnerer null hvis første tegn ikke er et af de 28 grundbogstaver.
 */
export function detectFirstLetter(wordAr: string, letters: Letter[]): Letter | null {
  const normalized = normalizeArabic(wordAr);
  const first = normalized[0];
  if (!first) return null;
  return letters.find((l) => l.letter === first) ?? null;
}

/** Er kandidaten en dublet af et eksisterende ord? (normaliseret ar + da) */
export function isDuplicateWord(
  candidate: { word_ar: string; word_da: string },
  existing: Pick<VocabularyWord, "word_ar" | "word_da">[],
): boolean {
  const ar = normalizeArabic(candidate.word_ar);
  const da = candidate.word_da.trim().toLowerCase();
  return existing.some(
    (w) => normalizeArabic(w.word_ar) === ar || w.word_da.trim().toLowerCase() === da,
  );
}

/** Hent HELE ordforrådet (admin/editor ser også kladder via RLS). */
export async function fetchVocabulary(
  messages: VokabVaerkstedMessages,
): Promise<{ ok: true; words: VocabularyWord[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("vocabulary")
    .select("*")
    .order("category", { ascending: true })
    .order("word_da", { ascending: true });
  if (error) return { ok: false, error: messages.fetchVocabularyError };
  return { ok: true, words: (data ?? []) as VocabularyWord[] };
}

/** Hent de 28 bogstaver (til første-bogstav-kobling). */
export async function fetchLetters(
  messages: VokabVaerkstedMessages,
): Promise<{ ok: true; letters: Letter[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("letters")
    .select("*")
    .order("position", { ascending: true });
  if (error) return { ok: false, error: messages.fetchLettersError };
  return { ok: true, letters: (data ?? []) as Letter[] };
}

export interface VocabDraftInput {
  word_ar: string;
  word_da: string;
  transliteration: string;
  category: VocabCategory;
  level: number;
  register: "fusha" | "everyday";
  emoji: string | null;
  first_letter_id: string | null;
}

/**
 * Indsæt et nyt ord som KLADDE.
 * `is_published: false` er hardcodet — udgivelse er altid en separat,
 * menneskelig handling. `suggested_by` markerer proveniens varigt.
 */
export async function insertDraft(
  input: VocabDraftInput,
  suggestedBy: "human" | "ai",
  messages: VokabVaerkstedMessages,
): Promise<{ ok: true; word: VocabularyWord } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("vocabulary")
    .insert({
      ...input,
      emoji: input.emoji || null,
      // === Muren: kladde altid, proveniens altid ===
      is_published: false,
      suggested_by: suggestedBy,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: messages.wordAlreadyExists };
    }
    return { ok: false, error: messages.wordSaveFailed };
  }
  return { ok: true, word: data as VocabularyWord };
}

/** Tænd/sluk ordets lys — den menneskelige udgivelses-handling. */
export async function setPublished(
  id: string,
  published: boolean,
  messages: VokabVaerkstedMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("vocabulary")
    .update({ is_published: published })
    .eq("id", id);
  if (error) return { ok: false, error: messages.publishChangeFailed };
  return { ok: true };
}

export interface AiSuggestion {
  word_ar: string;
  word_da: string;
  transliteration: string;
  emoji: string | null;
  level: number;
}

/**
 * Hent AI-forslag fra Edge Function `suggest-vocab`.
 * Funktionen kræver admin/editor-JWT, dublet-filtrerer selv mod hele
 * ordforrådet og SKRIVER ALDRIG i databasen — den returnerer kun forslag.
 * Klienten filtrerer igen mod `existing` (lag 2 af dublet-værnet).
 */
export async function fetchAiSuggestions(
  category: VocabCategory,
  count: number,
  existing: VocabularyWord[],
  messages: VokabVaerkstedMessages,
): Promise<{ ok: true; suggestions: AiSuggestion[] } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke("suggest-vocab", {
    body: { category, count },
  });
  if (error) {
    return {
      ok: false,
      error: messages.aiSuggestionsFailed,
    };
  }
  const raw: unknown = (data as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(raw)) {
    return { ok: false, error: messages.aiUnexpectedResponse };
  }
  const suggestions = raw
    .filter(
      (s): s is AiSuggestion =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as AiSuggestion).word_ar === "string" &&
        typeof (s as AiSuggestion).word_da === "string" &&
        typeof (s as AiSuggestion).transliteration === "string",
    )
    .filter((s) => hasArabicScript(s.word_ar))
    .filter((s) => !isDuplicateWord(s, existing))
    .slice(0, count);
  return { ok: true, suggestions };
}
