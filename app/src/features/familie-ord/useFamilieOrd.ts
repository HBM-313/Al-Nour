/**
 * useFamilieOrd — state for "Familieord"-sektionen i forældre-dashboardet
 * (Leverance D4). Samme patch-mønster som useVokabVaerksted/useDashboard.
 */

import { useCallback, useEffect, useState } from "react";
import type { CustomWord, Letter } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import {
  deleteCustomWord,
  fetchCustomWords,
  fetchLettersForFamilieOrd,
  insertCustomWord,
  updateCustomWord,
  type CustomWordInput,
} from "./engine";

export interface FamilieOrdState {
  open: boolean;
  loading: boolean;
  error: string | null;
  words: CustomWord[];
  letters: Letter[];
  formOpen: boolean;
  editing: CustomWord | null;
  saving: boolean;
  notice: string | null;
}

const INITIAL: FamilieOrdState = {
  open: false,
  loading: true,
  error: null,
  words: [],
  letters: [],
  formOpen: false,
  editing: null,
  saving: false,
  notice: null,
};

export function useFamilieOrd(accountId: string) {
  const [state, setState] = useState<FamilieOrdState>(INITIAL);
  const { t } = useLanguage();

  const patch = useCallback((p: Partial<FamilieOrdState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const reload = useCallback(async () => {
    patch({ loading: true, error: null });
    const [wordsRes, lettersRes] = await Promise.all([
      fetchCustomWords(t.familieOrd),
      fetchLettersForFamilieOrd(t.familieOrd),
    ]);
    if (!wordsRes.ok) {
      patch({ loading: false, error: wordsRes.error });
      return;
    }
    patch({
      loading: false,
      words: wordsRes.words,
      letters: lettersRes.ok ? lettersRes.letters : [],
    });
  }, [patch, t]);

  /** Hentes først når sektionen åbnes første gang — familie-data, ikke nødvendig ved hver dashboard-visning. */
  const toggleOpen = useCallback(() => {
    let shouldLoad = false;
    setState((s) => {
      const nextOpen = !s.open;
      shouldLoad = nextOpen && s.loading && s.words.length === 0;
      return { ...s, open: nextOpen };
    });
    if (shouldLoad) void reload();
  }, [reload]);

  const openForm = useCallback(
    (word: CustomWord | null) => {
      patch({ formOpen: true, editing: word });
    },
    [patch],
  );

  const closeForm = useCallback(() => {
    patch({ formOpen: false, editing: null });
  }, [patch]);

  const save = useCallback(
    async (input: CustomWordInput): Promise<string | null> => {
      patch({ saving: true });
      if (state.editing) {
        const res = await updateCustomWord(state.editing.id, input, t.familieOrd);
        patch({ saving: false });
        if (!res.ok) return res.error;
        setState((s) => ({
          ...s,
          words: s.words.map((w) => (w.id === res.word.id ? res.word : w)),
          formOpen: false,
          editing: null,
          notice: t.familieOrd.updatedNotice(res.word.word_da),
        }));
        return null;
      }
      const res = await insertCustomWord(accountId, input, t.familieOrd);
      patch({ saving: false });
      if (!res.ok) return res.error;
      setState((s) => ({
        ...s,
        words: [...s.words, res.word],
        formOpen: false,
        editing: null,
        notice: t.familieOrd.addedNotice(res.word.word_da),
      }));
      return null;
    },
    [accountId, state.editing, patch, t],
  );

  const remove = useCallback(
    async (word: CustomWord) => {
      const res = await deleteCustomWord(word.id, t.familieOrd);
      if (!res.ok) {
        patch({ notice: res.error });
        return;
      }
      setState((s) => ({
        ...s,
        words: s.words.filter((w) => w.id !== word.id),
        notice: t.familieOrd.deletedNotice(word.word_da),
      }));
    },
    [patch, t],
  );

  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => patch({ notice: null }), 2600);
    return () => window.clearTimeout(timer);
  }, [state.notice, patch]);

  return { state, toggleOpen, openForm, closeForm, save, remove };
}
