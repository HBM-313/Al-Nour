/**
 * useVokabVaerksted — state for Ordforråds-værkstedet.
 * Samme patch-mønster som useDashboard. Al skrivning går gennem engine.ts,
 * der hardcoder kladde-reglen (se murens kommentarer dér).
 */

import { useCallback, useEffect, useState } from "react";
import type { Letter, VocabularyWord } from "@/lib/types";
import { useT } from "@/lib/i18n";
import {
  fetchAiSuggestions,
  fetchLetters,
  fetchVocabulary,
  insertDraft,
  setPublished,
  type AiSuggestion,
  type VocabCategory,
  type VocabDraftInput,
} from "./engine";

export type VaerkstedTab = "liste" | "nyt" | "ai";
export type StatusFilter = "alle" | "kladde" | "udgivet" | "ai";

export interface VaerkstedState {
  loading: boolean;
  error: string | null;
  words: VocabularyWord[];
  letters: Letter[];
  tab: VaerkstedTab;
  // Ordliste-filtre
  search: string;
  statusFilter: StatusFilter;
  categoryFilter: VocabCategory | "";
  // AI-forslag
  aiLoading: boolean;
  aiError: string | null;
  suggestions: AiSuggestion[];
  /** Kort kvitterings-besked (toast) */
  notice: string | null;
}

const INITIAL: VaerkstedState = {
  loading: true,
  error: null,
  words: [],
  letters: [],
  tab: "liste",
  search: "",
  statusFilter: "alle",
  categoryFilter: "",
  aiLoading: false,
  aiError: null,
  suggestions: [],
  notice: null,
};

export function useVokabVaerksted() {
  const [state, setState] = useState<VaerkstedState>(INITIAL);
  const t = useT("da");

  const patch = useCallback((p: Partial<VaerkstedState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const reload = useCallback(async () => {
    patch({ loading: true, error: null });
    const [vocabRes, lettersRes] = await Promise.all([
      fetchVocabulary(t.vokabVaerksted),
      fetchLetters(t.vokabVaerksted),
    ]);
    if (!vocabRes.ok) {
      patch({ loading: false, error: vocabRes.error });
      return;
    }
    if (!lettersRes.ok) {
      patch({ loading: false, error: lettersRes.error });
      return;
    }
    patch({ loading: false, words: vocabRes.words, letters: lettersRes.letters });
  }, [patch, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Gem et menneske-skrevet ord som kladde. */
  const saveDraft = useCallback(
    async (input: VocabDraftInput): Promise<string | null> => {
      const res = await insertDraft(input, "human", t.vokabVaerksted);
      if (!res.ok) return res.error;
      setState((s) => ({
        ...s,
        words: [...s.words, res.word],
        tab: "liste",
        statusFilter: "kladde",
        notice: t.vokabVaerksted.draftSavedNotice(res.word.word_da),
      }));
      return null;
    },
    [t],
  );

  /** Tænd/sluk ordets lys (menneskelig udgivelses-handling). */
  const togglePublish = useCallback(
    async (word: VocabularyWord) => {
      const next = !word.is_published;
      const res = await setPublished(word.id, next, t.vokabVaerksted);
      if (!res.ok) {
        setState((s) => ({ ...s, notice: res.error }));
        return;
      }
      setState((s) => ({
        ...s,
        words: s.words.map((w) => (w.id === word.id ? { ...w, is_published: next } : w)),
        notice: next
          ? word.audio_media_id
            ? t.vokabVaerksted.publishedNotice(word.word_da)
            : t.vokabVaerksted.publishedNoAudioNotice(word.word_da)
          : t.vokabVaerksted.unpublishedNotice(word.word_da),
      }));
    },
    [t],
  );

  /** Hent AI-forslag (dublet-filtreret i funktionen OG her via engine). */
  const loadSuggestions = useCallback(
    async (category: VocabCategory, count: number) => {
      patch({ aiLoading: true, aiError: null, suggestions: [] });
      const res = await fetchAiSuggestions(category, count, state.words, t.vokabVaerksted);
      if (!res.ok) {
        patch({ aiLoading: false, aiError: res.error });
        return;
      }
      patch({ aiLoading: false, suggestions: res.suggestions });
    },
    [patch, state.words, t],
  );

  /** Gem ét AI-forslag som kladde (proveniens 'ai' — kan aldrig fødes udgivet). */
  const saveSuggestion = useCallback(
    async (sugg: AiSuggestion, category: VocabCategory, firstLetterId: string | null) => {
      const res = await insertDraft(
        {
          word_ar: sugg.word_ar,
          word_da: sugg.word_da,
          transliteration: sugg.transliteration,
          category,
          level: sugg.level >= 1 && sugg.level <= 4 ? sugg.level : 1,
          register: "fusha",
          emoji: sugg.emoji,
          first_letter_id: firstLetterId,
        },
        "ai",
        t.vokabVaerksted,
      );
      setState((s) => ({
        ...s,
        suggestions: s.suggestions.filter((x) => x.word_ar !== sugg.word_ar),
        ...(res.ok
          ? { words: [...s.words, res.word], notice: t.vokabVaerksted.aiDraftSavedNotice(sugg.word_da) }
          : { notice: res.error }),
      }));
    },
    [t],
  );

  const discardSuggestion = useCallback((sugg: AiSuggestion) => {
    setState((s) => ({
      ...s,
      suggestions: s.suggestions.filter((x) => x.word_ar !== sugg.word_ar),
    }));
  }, []);

  return {
    state,
    patch,
    reload,
    saveDraft,
    togglePublish,
    loadSuggestions,
    saveSuggestion,
    discardSuggestion,
  };
}
