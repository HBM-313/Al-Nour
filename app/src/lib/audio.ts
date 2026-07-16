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
//
// Robusthed (efter ejer-test 2026-07-16 på enhed med kun én dansk stemme):
//   1. Stemmer indlæses ASYNKRONT — getVoices() er ofte tom ved første kald,
//      så vi cacher og lytter på voiceschanged.
//   2. cancel() umiddelbart fulgt af speak() sluger ytringen i Chrome —
//      der lægges en kort pause + resume() imellem.
//   3. En stemme der ikke matcher sproget "taler" stumt (onstart+onend uden
//      lyd) — derfor taler vi KUN når en matchende stemme findes, og
//      speakArabic falder ellers tilbage til det danske navn, som enhedens
//      egen stemme faktisk kan udtale.
// ----------------------------------------------------------------------------

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let voiceCache: SpeechSynthesisVoice[] = [];
let voicesInitialized = false;

function refreshVoices(): void {
  try {
    voiceCache = window.speechSynthesis.getVoices() ?? [];
  } catch {
    voiceCache = [];
  }
}

function initVoices(): void {
  if (voicesInitialized || !canSpeak()) return;
  voicesInitialized = true;
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

/** Vent (kort) på at browserens stemmeliste er indlæst. */
async function ensureVoices(): Promise<void> {
  initVoices();
  if (voiceCache.length > 0) return;
  for (let i = 0; i < 5 && voiceCache.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 120));
    refreshVoices();
  }
}

function findVoice(langPrefix: string): SpeechSynthesisVoice | null {
  const p = langPrefix.toLowerCase();
  return voiceCache.find((v) => v.lang.toLowerCase().startsWith(p)) ?? null;
}

/** Har enheden en stemme for sproget? (fx "ar", "da") */
export async function hasVoiceFor(langPrefix: string): Promise<boolean> {
  if (!canSpeak()) return false;
  await ensureVoices();
  return findVoice(langPrefix) !== null;
}

/**
 * Udtal tekst med browserens talesyntese.
 * Taler KUN hvis en stemme der matcher sproget findes — en umatchet stemme
 * fejler stumt (bevist ved ejer-test), hvilket er værre end at returnere
 * false så UI'et kan vælge en fallback.
 */
export function speak(text: string, lang = "ar-SA"): Promise<boolean> {
  return new Promise((resolve) => {
    if (!canSpeak()) {
      resolve(false);
      return;
    }
    void ensureVoices().then(() => {
      const voice = findVoice(lang.slice(0, 2));
      if (!voice) {
        resolve(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        // Chrome/Android: speak() synkront efter cancel() sluges — kort pause.
        setTimeout(() => {
          try {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang;
            u.voice = voice;
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
            // Nogle browsere fyrer hverken onstart eller onerror — betragt
            // det som fejl efter 2 sek.
            setTimeout(() => done(false), 2000);

            window.speechSynthesis.resume(); // vækker autoplay-paused tilstand
            window.speechSynthesis.speak(u);
          } catch {
            resolve(false);
          }
        }, 80);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Udtal arabisk — eller fald tilbage til det danske navn/ord, som enhedens
 * egen stemme kan udtale, når ingen arabisk stemme findes.
 * Returnerer hvilken vej der lykkedes, så UI'et kan vise tekst ved 'none'.
 */
export async function speakArabic(
  textAr: string,
  fallbackDa?: string,
): Promise<"ar" | "da" | "none"> {
  if (await speak(textAr, "ar-SA")) return "ar";
  if (fallbackDa && (await speak(fallbackDa, "da-DK"))) return "da";
  return "none";
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
