/**
 * voicePref — hvilken oplæser-stemme barnet hører (ejer-beslutning):
 * pige → kvindestemme (Habibah), dreng → mandsstemme (Ahmed).
 *
 * Indtil profiler/auth er bygget styres valget af en kontakt i appen og
 * huskes i localStorage. Når profilen kommer, sættes præferencen derfra
 * (barnets valgte avatar/køn) — dette modul forbliver kilden, så spillene
 * ikke skal ændres igen.
 *
 * Datamodel: audio_media_id = kvindestemme (standard/fallback),
 * audio_media_id_male = mandsstemme. Mangler det valgte spor, bruges det
 * andet (fail-soft — hellere den anden stemme end stilhed).
 */

export type VoicePref = "female" | "male";

const KEY = "nour_voice_pref_v1";

export function getVoicePref(): VoicePref {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "male" ? "male" : "female";
  } catch {
    return "female";
  }
}

export function setVoicePref(pref: VoicePref): void {
  try {
    window.localStorage.setItem(KEY, pref);
  } catch {
    // Uden lager gælder valget kun indeværende sidevisning.
  }
}

/**
 * Vælg det rigtige lyd-medie for en række med to stemmespor.
 * Returnerer null hvis rækken slet ingen lyd har (→ browser-TTS-fallback).
 */
export function preferredAudioId(row: {
  audio_media_id: string | null;
  audio_media_id_male?: string | null;
}): string | null {
  const male = row.audio_media_id_male ?? null;
  if (getVoicePref() === "male") {
    return male ?? row.audio_media_id;
  }
  return row.audio_media_id ?? male;
}
