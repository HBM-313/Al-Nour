/**
 * Lydafspilning for Lyt & Find.
 *
 * LYD-REGLEN (ejer-beslutning 2026-07-14):
 * Al lyd må være TTS/AI-genereret eller uploadet fil og kan frit udskiftes
 * (fx ElevenLabs, Google, egen optagelse). DEN ENESTE UNDTAGELSE er
 * Quran-recitation, som skal være menneskelig — håndhævet i DB af
 * media_ai_never_recitation og trg_letters_audio_valid.
 *
 * Prioritering her: medie-fil fra media-tabellen vinder ALTID over browser-
 * TTS. TTS er kun pladsholder indtil en fil kobles på — så bliver lyden
 * automatisk fil-drevet uden kodeændring.
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

// ----------------------------------------------------------------------------
// Browser-TTS (pladsholder-stemme — aldrig for recitation)
// ----------------------------------------------------------------------------

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Udtal arabisk tekst med browserens talesyntese.
 * Løser til true hvis afspilningen faktisk startede — false ved manglende
 * arabisk stemme, autoplay-blokering eller anden fejl, så UI'et kan falde
 * tilbage til tekst-prompt i stedet for at efterlade barnet i stilhed.
 */
export function speak(text: string, lang = "ar-SA"): Promise<boolean> {
  return new Promise((resolve) => {
    if (!canSpeak()) {
      resolve(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      // Foretræk en installeret stemme der matcher det ønskede sprog
      // (tidligere altid arabisk — forkert når spillene siger dansk)
      const langPrefix = lang.slice(0, 2).toLowerCase();
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.lang.toLowerCase().startsWith(langPrefix));
      if (voice) u.voice = voice;
      u.rate = 0.85; // en anelse langsommere — det er børn der lytter

      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      u.onstart = () => done(true);
      u.onerror = () => done(false);
      // Nogle browsere fyrer hverken onstart eller onerror når stemmen
      // mangler — betragt det som fejl efter 2 sek.
      setTimeout(() => done(false), 2000);

      window.speechSynthesis.speak(u);
    } catch {
      resolve(false);
    }
  });
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
