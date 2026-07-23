/**
 * useOpretProfil — trin-maskine for opret barneprofil-flowet.
 * Spejler den ejer-godkendte demo (nour-opret-profil-demo.html) 1:1:
 * about → pin (valgfrit) → confirm → summary → saving → done.
 */

import { useCallback, useState } from "react";
import type { Profile, VoicePref } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { createChildProfile, PIN_MAX, PIN_MIN } from "./engine";

export type OpretStep = "about" | "pin" | "confirm" | "summary" | "saving" | "done";

export interface OpretState {
  step: OpretStep;
  name: string;
  birthYear: number | null;
  avatar: string | null;
  voice: VoicePref;
  /** Pool-index-sekvens som strenge (set_child_pin-kontrakt) */
  pin: string[];
  pinConfirm: string[];
  error: string | null;
  pinWarning: string | null;
  createdProfile: Profile | null;
}

const INITIAL: OpretState = {
  step: "about",
  name: "",
  birthYear: null,
  avatar: null,
  voice: "female", // DB-default
  pin: [],
  pinConfirm: [],
  error: null,
  pinWarning: null,
  createdProfile: null,
};

export function useOpretProfil(ownerAccountId: string, onCreated?: (p: Profile) => void) {
  const [state, setState] = useState<OpretState>(INITIAL);
  const t = useT("da");

  const patch = useCallback((p: Partial<OpretState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const aboutComplete =
    state.name.trim().length >= 1 && state.birthYear !== null && state.avatar !== null;

  const confirmDone = state.pinConfirm.length === state.pin.length && state.pin.length > 0;
  const confirmMatch = confirmDone && state.pinConfirm.every((v, i) => v === state.pin[i]);
  const confirmMismatch =
    state.pinConfirm.length > 0 && state.pinConfirm.some((v, i) => v !== state.pin[i]);

  const tapAnimal = useCallback((target: "pin" | "pinConfirm", poolIndex: number) => {
    setState((s) => {
      const seq = s[target];
      if (seq.length >= PIN_MAX) return s;
      return { ...s, [target]: [...seq, String(poolIndex)] };
    });
  }, []);

  const create = useCallback(async () => {
    setState((s) => ({ ...s, step: "saving", error: null }));
    const result = await createChildProfile(
      ownerAccountId,
      {
        displayName: state.name,
        birthYear: state.birthYear ?? 0,
        avatar: state.avatar ?? "",
        preferredVoice: state.voice,
        pinSequence: state.pin,
      },
      {
        emptyName: t.opretProfil.errorEmptyName,
        pinSaveFailed: t.opretProfil.pinSaveFailed,
        errorGeneric: t.opretProfil.errorGeneric,
        errorRls: t.opretProfil.errorRls,
        errorBirthYear: t.opretProfil.errorBirthYear,
        errorNetwork: t.opretProfil.errorNetwork,
        errorFallback: t.opretProfil.errorFallback,
      },
    );
    if (!result.ok) {
      setState((s) => ({ ...s, step: "summary", error: result.error }));
      return;
    }
    setState((s) => ({
      ...s,
      step: "done",
      createdProfile: result.profile,
      pinWarning: result.pinWarning ?? null,
    }));
    onCreated?.(result.profile);
  }, [ownerAccountId, state.name, state.birthYear, state.avatar, state.voice, state.pin, onCreated, t]);

  const reset = useCallback(() => setState(INITIAL), []);

  return {
    state,
    patch,
    aboutComplete,
    confirmMatch,
    confirmMismatch,
    canConfirmPin: state.pin.length >= PIN_MIN,
    tapAnimal,
    create,
    reset,
  };
}
