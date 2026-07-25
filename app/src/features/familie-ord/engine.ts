/**
 * familie-ord — engine (Leverance D4, plan-boernesession-og-dashboard.md
 * §6.5): forælderens egne ord. VIGTIGT: disse ord går ALDRIG ind i
 * `vocabulary` (admin/editor-only, godkendt katalog-mur) — egen tabel
 * (`custom_words`, migration 20260725_custom_words_d4), ejet af
 * account_id (forælderens konto, ikke ét barns). RLS afgrænser til
 * familien; se migrationens kommentarer for det fulde mur-bevis.
 *
 * Genbruger bevidst normaliserings-/dublet-/bogstav-detektionslogik fra
 * vokab-vaerksted/engine.ts i stedet for at duplikere den — samme
 * hamza-normalisering skal gælde begge steder, ellers driver de fra
 * hinanden.
 */

import { supabase } from "@/lib/supabase";
import type { CustomWord, Letter, VocabularyRegister, VocabularyWord } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";
import {
  VOCAB_CATEGORIES,
  detectFirstLetter,
  hasArabicScript,
  isDuplicateWord,
  normalizeArabic,
  type VocabCategory,
} from "@/features/vokab-vaerksted/engine";

export type FamilieOrdMessages = Dictionary["familieOrd"];

// Genexporteret så komponenten/hooken kun behøver importere fra denne fil.
export { VOCAB_CATEGORIES, detectFirstLetter, hasArabicScript, isDuplicateWord, normalizeArabic };
export type { VocabCategory };

/** Hent hele familiens ordliste (RLS afgrænser automatisk til egen familie/barn). */
export async function fetchCustomWords(
  messages: FamilieOrdMessages,
): Promise<{ ok: true; words: CustomWord[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("custom_words")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: messages.fetchError };
  return { ok: true, words: (data ?? []) as CustomWord[] };
}

export interface CustomWordInput {
  word_ar: string;
  word_da: string;
  transliteration: string;
  category: VocabCategory;
  level: number;
  register: VocabularyRegister;
  emoji: string | null;
  first_letter_id: string | null;
}

/** Opret et nyt familieord. Kræver forælderens account_id (WITH CHECK på custom_words_owner_all). */
export async function insertCustomWord(
  accountId: string,
  input: CustomWordInput,
  messages: FamilieOrdMessages,
): Promise<{ ok: true; word: CustomWord } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("custom_words")
    .insert({ account_id: accountId, ...input })
    .select("*")
    .single();
  if (error) return { ok: false, error: messages.saveFailed };
  return { ok: true, word: data as CustomWord };
}

/** Ret et eksisterende familieord. */
export async function updateCustomWord(
  id: string,
  input: CustomWordInput,
  messages: FamilieOrdMessages,
): Promise<{ ok: true; word: CustomWord } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("custom_words")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, error: messages.saveFailed };
  return { ok: true, word: data as CustomWord };
}

/** Slet et familieord. */
export async function deleteCustomWord(
  id: string,
  messages: FamilieOrdMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("custom_words").delete().eq("id", id);
  if (error) return { ok: false, error: messages.deleteFailed };
  return { ok: true };
}

/**
 * Map et familieord til VocabularyWord-formen, så det kan blandes ind i
 * Match-par/Lyt & Find's ordpuljer uden at røre engine.ts-logikken i de
 * spil (pickRoundWords/buildDeck/isMatch kender kun formen, ikke kilden).
 * `is_published: true` og `suggested_by: 'human'` er syntetiske — et
 * familieord kræver ingen godkendelse (se migrationens header).
 */
export function customWordToVocabularyWord(cw: CustomWord): VocabularyWord {
  return {
    id: cw.id,
    word_ar: cw.word_ar,
    transliteration: cw.transliteration,
    word_da: cw.word_da,
    category: cw.category,
    register: cw.register,
    first_letter_id: cw.first_letter_id,
    level: cw.level,
    emoji: cw.emoji,
    image_media_id: cw.image_media_id,
    audio_media_id: cw.audio_media_id,
    audio_media_id_male: cw.audio_media_id_male,
    is_published: true,
    suggested_by: "human",
    created_at: cw.created_at,
    updated_at: cw.updated_at,
  };
}

/** Fletter familiens ord ind i en hentet vocabulary-liste (spillenes load()). */
export function mergeCustomWords(
  vocabulary: readonly VocabularyWord[],
  customWords: readonly CustomWord[],
): VocabularyWord[] {
  return [...vocabulary, ...customWords.map(customWordToVocabularyWord)];
}

/** Bogstaver til første-bogstav-kobling (samme kilde som vokab-vaerksted). */
export async function fetchLettersForFamilieOrd(
  messages: FamilieOrdMessages,
): Promise<{ ok: true; letters: Letter[] } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("letters").select("*").order("position", { ascending: true });
  if (error) return { ok: false, error: messages.fetchError };
  return { ok: true, letters: (data ?? []) as Letter[] };
}
