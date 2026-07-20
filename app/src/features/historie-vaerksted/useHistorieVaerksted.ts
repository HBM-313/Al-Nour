/**
 * useHistorieVaerksted — state for Historie-værkstedet.
 * Samme patch-mønster som useVokabVaerksted. Al skrivning går gennem
 * engine.ts, der hardcoder kladde-reglen (se murens kommentarer dér).
 */

import { useCallback, useEffect, useState } from "react";
import type { Content } from "@/lib/types";
import {
  fetchStories,
  insertDraft,
  setPublished,
  unverifySource,
  updateDraft,
  verifySource,
  type AqidahDraftInput,
} from "./engine";

export type VaerkstedTab = "liste" | "nyt";
export type StatusFilter = "alle" | "kladde" | "verificeret" | "udgivet";

export interface HistorieState {
  loading: boolean;
  error: string | null;
  stories: Content[];
  tab: VaerkstedTab;
  search: string;
  statusFilter: StatusFilter;
  /** Sat når "Redigér" er trykket — null = ny fortælling. */
  redigererId: string | null;
  notice: string | null;
}

const INITIAL: HistorieState = {
  loading: true,
  error: null,
  stories: [],
  tab: "liste",
  search: "",
  statusFilter: "alle",
  redigererId: null,
  notice: null,
};

export function useHistorieVaerksted() {
  const [state, setState] = useState<HistorieState>(INITIAL);

  const patch = useCallback((p: Partial<HistorieState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const reload = useCallback(async () => {
    patch({ loading: true, error: null });
    const res = await fetchStories();
    if (!res.ok) {
      patch({ loading: false, error: res.error });
      return;
    }
    patch({ loading: false, stories: res.stories });
  }, [patch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Gem ny fortælling ELLER eksisterende redigering — altid som kladde ved oprettelse. */
  const save = useCallback(
    async (input: AqidahDraftInput, id: string | null): Promise<string | null> => {
      if (id) {
        const res = await updateDraft(id, input);
        if (!res.ok) return res.error;
        await reload();
        setState((s) => ({ ...s, tab: "liste", redigererId: null, notice: "Ændringerne er gemt." }));
        return null;
      }
      const res = await insertDraft(input);
      if (!res.ok) return res.error;
      setState((s) => ({
        ...s,
        stories: [res.story, ...s.stories],
        tab: "liste",
        statusFilter: "kladde",
        notice: `„${res.story.title_da}" er gemt som kladde. En godkender kan nu kilde-verificere den.`,
      }));
      return null;
    },
    [reload],
  );

  const verify = useCallback(async (story: Content) => {
    const res = await verifySource(story.id);
    if (!res.ok) {
      setState((s) => ({ ...s, notice: res.error }));
      return;
    }
    setState((s) => ({
      ...s,
      stories: s.stories.map((x) => (x.id === story.id ? { ...x, is_source_verified: true } : x)),
      notice: `„${story.title_da}" er kilde-verificeret — klar til udgivelse.`,
    }));
  }, []);

  const unverify = useCallback(async (story: Content) => {
    const res = await unverifySource(story.id);
    if (!res.ok) {
      setState((s) => ({ ...s, notice: res.error }));
      return;
    }
    setState((s) => ({
      ...s,
      stories: s.stories.map((x) => (x.id === story.id ? { ...x, is_source_verified: false } : x)),
      notice: `Verifikationen af „${story.title_da}" er fjernet.`,
    }));
  }, []);

  const togglePublish = useCallback(async (story: Content) => {
    const next = !story.is_published;
    const res = await setPublished(story.id, next);
    if (!res.ok) {
      setState((s) => ({ ...s, notice: res.error }));
      return;
    }
    setState((s) => ({
      ...s,
      stories: s.stories.map((x) => (x.id === story.id ? { ...x, is_published: next } : x)),
      notice: next
        ? `„${story.title_da}" lyser nu i Historiernes Bjerge 🏔️`
        : `„${story.title_da}" er ikke længere synlig for børn.`,
    }));
  }, []);

  const startEdit = useCallback((id: string | null) => {
    setState((s) => ({ ...s, redigererId: id, tab: "nyt" }));
  }, []);

  const cancelEdit = useCallback(() => {
    setState((s) => ({ ...s, redigererId: null, tab: "liste" }));
  }, []);

  return { state, patch, reload, save, verify, unverify, togglePublish, startEdit, cancelEdit };
}
