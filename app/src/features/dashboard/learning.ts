/**
 * learning — D2: oversæt spil-tællere til lærings-tal for forælderen.
 *
 * plan-boernesession-og-dashboard.md §6.1: en forælder vil vide *lærer mit
 * barn noget, og hvad kan jeg gøre sammen med dem?* — ikke hvor mange
 * minutter barnet var inde. XP er spilvaluta og siger intet; "17 af 28
 * bogstaver" siger alt.
 *
 * REN LOGIK, ingen React og ingen DB — al hentning ligger i engine.ts.
 * Det er her tærsklerne bor, og det er dem der bestemmer hvad forælderen
 * får at vide, så de er testet direkte (learning.test.ts).
 *
 * ÆRLIGHED OM DATA (vigtigt): `profile_item_stats` er BEVIDST rene tællere
 * (seen/correct), ikke en hændelseslog — vi ved altså *at* ب driller, men
 * aldrig *hvad* barnet trykkede på i stedet. Derfor formuleres forklaringen
 * som lighed ("ب ligner ت og ث"), ikke som en påstået forveksling, medmindre
 * begge bogstaver i samme rasm-gruppe rent faktisk er svage hos barnet —
 * først dér er "driller begge" en observation og ikke et gæt.
 *
 * §6.7 gælder hele filen: intet her sammenligner barnet med andre børn,
 * måler tid eller analyserer adfærd.
 */

import { similarTo } from "@/lib/letterSimilarity";
import type { Letter, VocabularyWord } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

export type LearningMessages = Dictionary["dashboard"];

/** Én række fra profile_item_stats (kun de felter D2 bruger). */
export interface ItemStat {
  item_type: "letter" | "vocabulary";
  item_id: string;
  seen_count: number;
  correct_count: number;
}

/**
 * Tærskler (ejer-besluttet 2026-07-24).
 *
 * MIN_SEEN gælder BEGGE veje med vilje: uden den ville ét enkelt heldigt
 * eller uheldigt svar kunne rykke et bogstav ind i "kan" eller ud i "øver
 * stadig", og forælderen ville se tal der hopper uden grund. Tre visninger
 * er nok til at et mønster er et mønster.
 */
export const MIN_SEEN = 3;
export const KNOWN_RATE = 0.7;
export const STRUGGLING_RATE = 0.4;

/** Hvor mange "her øver stadig"-linjer forælderen får ad gangen. */
export const MAX_STRUGGLES = 3;

export type ItemMastery = "known" | "struggling" | "learning";

/**
 * Klassificér én tæller. `learning` = i gang eller for lidt data endnu —
 * bevidst en neutral midterkategori, så barnet hverken roses eller
 * udpeges på et for tyndt grundlag.
 */
export function classifyStat(stat: ItemStat): ItemMastery {
  if (stat.seen_count < MIN_SEEN) return "learning";
  const rate = stat.correct_count / stat.seen_count;
  if (rate >= KNOWN_RATE) return "known";
  if (rate < STRUGGLING_RATE) return "struggling";
  return "learning";
}

export interface StruggleLine {
  /** Bogstavet selv (ب) eller ordets emoji — visuelt anker i venstre kolonne */
  glyph: string;
  /** Færdig, forælder-venlig dansk/arabisk sætning */
  text: string;
}

export interface LearningSummary {
  letters: { known: number; total: number };
  words: { known: number; total: number };
  /** Bogstaver barnet kan, i alfabetets rækkefølge — til "med hvilke" */
  knownLetters: string[];
  struggles: StruggleLine[];
  /** true = barnet har ingen tællere endnu (tom-tilstand, venlig tekst) */
  empty: boolean;
}

/**
 * Byg forælderens læringsbillede.
 *
 * `letters` og `words` er hele katalogerne (28 / de udgivne ord) — nævneren
 * skal være alt der findes at lære, ikke kun det barnet har mødt, ellers
 * ville "8 af 8" stå og lyse på et barn der lige er begyndt.
 */
export function summarizeLearning(
  stats: readonly ItemStat[],
  letters: readonly Letter[],
  words: readonly VocabularyWord[],
  messages: LearningMessages,
): LearningSummary {
  const letterById = new Map(letters.map((l) => [l.id, l]));
  const wordById = new Map(words.map((w) => [w.id, w]));

  const knownLetterRows: Letter[] = [];
  const strugglingLetters: { letter: Letter; rate: number }[] = [];
  const strugglingWords: { word: VocabularyWord; rate: number }[] = [];
  let knownWords = 0;

  for (const stat of stats) {
    const mastery = classifyStat(stat);
    const rate = stat.seen_count > 0 ? stat.correct_count / stat.seen_count : 0;

    if (stat.item_type === "letter") {
      const letter = letterById.get(stat.item_id);
      if (!letter) continue; // slettet/ukendt bogstav — spring stille over
      if (mastery === "known") knownLetterRows.push(letter);
      else if (mastery === "struggling") strugglingLetters.push({ letter, rate });
    } else {
      const word = wordById.get(stat.item_id);
      if (!word) continue;
      if (mastery === "known") knownWords++;
      else if (mastery === "struggling") strugglingWords.push({ word, rate });
    }
  }

  // Svageste først — det er dér øvelsen batter mest.
  strugglingLetters.sort((a, b) => a.rate - b.rate);
  strugglingWords.sort((a, b) => a.rate - b.rate);

  const strugglingSet = new Set(strugglingLetters.map((s) => s.letter.letter));
  const struggles: StruggleLine[] = [];

  for (const { letter } of strugglingLetters) {
    if (struggles.length >= MAX_STRUGGLES) break;
    // Andre bogstaver med samme rasm som barnet OGSÅ er svag i: først dér
    // kan vi ærligt sige "de driller begge" i stedet for blot "de ligner".
    const alsoWeak = similarTo(letter.letter).filter((l) => strugglingSet.has(l));
    struggles.push({
      glyph: letter.letter,
      text:
        alsoWeak.length > 0
          ? messages.struggleLetterPair(letter.letter, alsoWeak)
          : messages.struggleLetterAlone(letter.letter, letter.name_da, similarTo(letter.letter)),
    });
  }

  for (const { word } of strugglingWords) {
    if (struggles.length >= MAX_STRUGGLES) break;
    struggles.push({
      glyph: word.emoji ?? "💬",
      text: messages.struggleWord(word.word_ar, word.transliteration, word.word_da),
    });
  }

  return {
    letters: {
      known: knownLetterRows.length,
      total: letters.length,
    },
    words: { known: knownWords, total: words.length },
    knownLetters: knownLetterRows
      .sort((a, b) => a.position - b.position)
      .map((l) => l.letter),
    struggles,
    empty: stats.length === 0,
  };
}
