/**
 * Lydafspilning for Lyt & Find.
 *
 * LYD-REGLEN (SKILL.md + trg_letters_audio_human i DB):
 * Bogstavlyd er kerne-fusha og SKAL være menneskeligt optaget. Derfor findes
 * der bevidst INGEN syntetisk fallback (speechSynthesis/TTS) i dette modul —
 * mangler lyden, viser UI'et et tekst-fallback i stedet. AI-lyd kommer kun
 * ind via admin-medie-biblioteket for hverdagsordforråd, aldrig herfra.
 */

export interface AudioPlayer {
  /** Afspil en URL. Løser til true hvis afspilning startede. */
  play(url: string): Promise<boolean>;
  stop(): void;
  dispose(): void;
}

export function createAudioPlayer(): AudioPlayer {
  let el: HTMLAudioElement | null = null;

  return {
    async play(url: string): Promise<boolean> {
      try {
        if (!el) el = new Audio();
        el.pause();
        el.src = url;
        el.currentTime = 0;
        await el.play();
        return true;
      } catch {
        // Autoplay-blokering eller netværksfejl — UI falder tilbage til tekst.
        return false;
      }
    },

    stop() {
      el?.pause();
    },

    dispose() {
      if (el) {
        el.pause();
        el.src = "";
        el = null;
      }
    },
  };
}
