/**
 * localProgress — anonymt gæste-fremskridt i localStorage.
 *
 * Indtil profiler/auth er bygget (senere fase) gemmes fremskridt lokalt på
 * enheden, så verdenskortet lyser og "fortsæt hvor du slap" virker fra dag
 * ét. Når en profil findes, bruger useLesson/kortet databasen i stedet —
 * dette modul er KUN fallback uden profileId.
 *
 * GDPR: ingen persondata — kun lektions-id'er, trin-tal og XP på enhedens
 * eget lager. Nulstilles ved rydning af browserdata.
 *
 * current_step er indeks i den SKIND-filtrerede trinliste, derfor gemmes
 * pr. (lessonId, skin) — et skind-skifte må aldrig genoptage forkert.
 */

import type { AgeSkin } from "@/lib/types";

export interface LocalLessonProgress {
  /** Næste trin at spille (0-baseret, skind-relativt) */
  current_step: number;
  completed: boolean;
  xp: number;
}

type Store = Record<string, Partial<Record<AgeSkin, LocalLessonProgress>>>;

const KEY = "nour_local_progress_v1";

function read(): Store {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function getLocalProgress(
  lessonId: string,
  skin: AgeSkin,
): LocalLessonProgress | null {
  return read()[lessonId]?.[skin] ?? null;
}

export function getAllLocalProgress(
  skin: AgeSkin,
): Record<string, LocalLessonProgress> {
  const store = read();
  const out: Record<string, LocalLessonProgress> = {};
  for (const [lessonId, bySkin] of Object.entries(store)) {
    const p = bySkin[skin];
    if (p) out[lessonId] = p;
  }
  return out;
}

/** Samme kontrakt som saveStepProgress: nextStep = næste trin at spille. */
export function saveLocalStepProgress(
  lessonId: string,
  skin: AgeSkin,
  nextStep: number,
  earnedXp: number,
  lessonCompleted: boolean,
): { ok: boolean } {
  const store = read();
  const prev = store[lessonId]?.[skin];
  store[lessonId] = {
    ...store[lessonId],
    [skin]: {
      current_step: lessonCompleted ? 0 : nextStep,
      completed: lessonCompleted || (prev?.completed ?? false),
      xp: (prev?.xp ?? 0) + earnedXp,
    },
  };
  return { ok: write(store) };
}
