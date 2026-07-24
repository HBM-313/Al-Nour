/**
 * useHistorieVaerksted — state for Historie-værkstedet.
 * Samme patch-mønster som useVokabVaerksted. Al skrivning går gennem
 * engine.ts, der hardcoder kladde-reglen (se murens kommentarer dér).
 */

import { useCallback, useEffect, useState } from "react";
import type { Content } from "@/lib/types";
import { useT } from "@/lib/i18n";
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
  const t = useT("da");

  const patch = useCallback((p: Partial<HistorieState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const reload = useCallback(async () => {
    patch({ loading: true, error: null });
    const res = await fetchStories(t.historieVaerksted);
    if (!res.ok) {
      patch({ loading: false, error: res.error });
      return;
    }
    patch({ loading: false, stories: res.stories });
  }, [patch, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Gem ny fortælling ELLER eksisterende redigering — altid som kladde ved oprettelse. */
  const save = useCallback(
    async (input: AqidahDraftInput, id: string | null): Promise<string | null> => {
      if (id) {
        const res = await updateDraft(id, input, t.historieVaerksted);
        if (!res.ok) return res.error;
        await reload();
        setState((s) => ({ ...s, tab: "liste", redigererId: null, notice: t.historieVaerksted.changesSaved }));
        return null;
      }
      const res = await insertDraft(input, t.historieVaerksted);
      if (!res.ok) return res.error;
      setState((s) => ({
        ...s,
        stories: [res.story, ...s.stories],
        tab: "liste",
        statusFilter: "kladde",
        notice: t.historieVaerksted.draftSavedNotice(res.story.title_da),
      }));
      return null;
    },
    [reload, t],
  );

  const verify = useCallback(
    async (story: Content) => {
      const res = await verifySource(story.id, t.historieVaerksted);
      if (!res.ok) {
        setState((s) => ({ ...s, notice: res.error }));
        return;
      }
      setState((s) => ({
        ...s,
        stories: s.stories.map((x) => (x.id === story.id ? { ...x, is_source_verified: true } : x)),
        notice: t.historieVaerksted.verifiedNotice(story.title_da),
      }));
    },
    [t],
  );

  const unverify = useCallback(
    async (story: Content) => {
      const res = await unverifySource(story.id, t.historieVaerksted);
      if (!res.ok) {
        setState((s) => ({ ...s, notice: res.error }));
        return;
      }
      setState((s) => ({
        ...s,
        stories: s.stories.map((x) => (x.id === story.id ? { ...x, is_source_verified: false } : x)),
        notice: t.historieVaerksted.unverifiedNotice(story.title_da),
      }));
    },
    [t],
  );

  const togglePublish = useCallback(
    async (story: Content) => {
      const next = !story.is_published;
      const res = await setPublished(story.id, next, t.historieVaerksted);
      if (!res.ok) {
        setState((s) => ({ ...s, notice: res.error }));
        return;
      }
      setState((s) => ({
        ...s,
        stories: s.stories.map((x) => (x.id === story.id ? { ...x, is_published: next } : x)),
        notice: next
          ? t.historieVaerksted.publishedNotice(story.title_da)
          : t.historieVaerksted.unpublishedNotice(story.title_da),
      }));
    },
    [t],
  );

  const startEdit = useCallback((id: string | null) => {
    setState((s) => ({ ...s, redigererId: id, tab: "nyt" }));
  }, []);

  const cancelEdit = useCallback(() => {
    setState((s) => ({ ...s, redigererId: null, tab: "liste" }));
  }, []);

  return { state, patch, reload, save, verify, unverify, togglePublish, startEdit, cancelEdit };
}
