/**
 * useDashboard — state for forældre-oversigten (Leverance D).
 * Liste → (udfold fremskridt | slet med bekræftelse | pin-overlay) → opret
 * via Leverance C-formularen. Fremskridt hentes dovent pr. barn ved udfold.
 */

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import {
  deleteChildProfile,
  fetchChildren,
  fetchProgressSummary,
  provisionChildAuth,
  type ProgressSummary,
} from "./engine";

export type DashboardView = "list" | "create";

export interface DashboardState {
  view: DashboardView;
  loading: boolean;
  children: Profile[];
  error: string | null;
  /** Profil-id med udfoldet fremskridt (én ad gangen) */
  openProgressId: string | null;
  progress: Record<string, ProgressSummary | "loading" | "error">;
  /** Profil der afventer slette-bekræftelse */
  confirmDelete: Profile | null;
  deleting: boolean;
  /** Profil med åbent pin-overlay */
  pinTarget: Profile | null;
  /** Profil-id der lige nu aktiverer sin adgang (Leverance B1-lukning) */
  provisioningId: string | null;
  toast: string | null;
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    view: "list",
    loading: true,
    children: [],
    error: null,
    openProgressId: null,
    progress: {},
    confirmDelete: null,
    deleting: false,
    pinTarget: null,
    provisioningId: null,
    toast: null,
  });

  const patch = useCallback((p: Partial<DashboardState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await fetchChildren();
    setState((s) =>
      res.ok
        ? { ...s, loading: false, children: res.children }
        : { ...s, loading: false, error: res.error },
    );
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const showToast = useCallback((msg: string) => {
    setState((s) => ({ ...s, toast: msg }));
    window.setTimeout(() => setState((s) => ({ ...s, toast: null })), 2600);
  }, []);

  const toggleProgress = useCallback(async (child: Profile) => {
    let shouldFetch = false;
    setState((s) => {
      if (s.openProgressId === child.id) return { ...s, openProgressId: null };
      shouldFetch = s.progress[child.id] === undefined || s.progress[child.id] === "error";
      return {
        ...s,
        openProgressId: child.id,
        progress: shouldFetch ? { ...s.progress, [child.id]: "loading" } : s.progress,
      };
    });
    if (!shouldFetch) return;
    const res = await fetchProgressSummary(child);
    setState((s) => ({
      ...s,
      progress: { ...s.progress, [child.id]: res.ok ? res.summary : "error" },
    }));
  }, []);

  const confirmAndDelete = useCallback(async () => {
    const target = state.confirmDelete;
    if (!target) return;
    setState((s) => ({ ...s, deleting: true }));
    const res = await deleteChildProfile(target.id);
    if (!res.ok) {
      setState((s) => ({ ...s, deleting: false }));
      showToast(res.error ?? "Sletning fejlede");
      return;
    }
    setState((s) => ({
      ...s,
      deleting: false,
      confirmDelete: null,
      openProgressId: s.openProgressId === target.id ? null : s.openProgressId,
      children: s.children.filter((c) => c.id !== target.id),
    }));
    showToast(`${target.display_name}s profil og al data er slettet`);
  }, [state.confirmDelete, showToast]);

  const onCreated = useCallback(
    (profile: Profile) => {
      setState((s) => ({ ...s, children: [...s.children, profile] }));
      showToast(`${profile.display_name}s lanterne er tændt 🏮`);
    },
    [showToast],
  );

  /**
   * Aktivér barnets egen identitet (lukker B1's åbne ende — se
   * plan-boernesession-og-dashboard.md, del 4, note under B1/B2).
   * Idempotent: kan trygt trykkes igen uden at gøre skade.
   */
  const activateAccess = useCallback(
    async (child: Profile) => {
      if (child.auth_user_id) return; // allerede aktiveret, knappen bør ikke vises
      setState((s) => ({ ...s, provisioningId: child.id }));
      const res = await provisionChildAuth(child.id);
      setState((s) => ({ ...s, provisioningId: null }));
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      setState((s) => ({
        ...s,
        children: s.children.map((c) =>
          c.id === child.id ? { ...c, auth_user_id: c.auth_user_id ?? "activated" } : c,
        ),
      }));
      showToast(
        res.alreadyProvisioned
          ? `${child.display_name}s adgang var allerede aktiveret`
          : `${child.display_name}s egen adgang er aktiveret 🔑`,
      );
    },
    [showToast],
  );

  const onPinSaved = useCallback(
    (profile: Profile) => {
      setState((s) => ({
        ...s,
        pinTarget: null,
        children: s.children.map((c) =>
          c.id === profile.id ? { ...c, pin_hash: "set" } : c,
        ),
      }));
      showToast(`${profile.display_name}s dyre-kode er gemt 🔑`);
    },
    [showToast],
  );

  return {
    state,
    patch,
    reload,
    toggleProgress,
    confirmAndDelete,
    onCreated,
    onPinSaved,
    activateAccess,
  };
}
