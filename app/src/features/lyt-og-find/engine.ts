/**
 * Lyt & Find — spilmotor (ren logik, ingen React).
 *
 * Bygger en runde spørgsmål ud fra letters/vocabulary pr. aldersskind:
 *   soft (3–6): 6 spørgsmål, 2 valg, LETTE distraktorer (visuelt ulige bogstaver)
 *   mid  (7–10): 8 spørgsmål (bogstaver + ord), 4 valg, blandede distraktorer
 *   teen (11–14): 8 bogstav-form-spørgsmål (start/midt/slut), 4 valg,
 *                 SVÆRE distraktorer (visuelt lignende bogstaver, fx ب/ت/ث/ن)
 *
 * MUREN: Dette spil lever udelukkende i Bogstavernes Dal (AI-tilladt sprogdata).
 * Det læser aldrig fra `content` og kan pr. konstruktion ikke røre aqidah.
 */

import type { AgeSkin, Letter, LetterForm, VocabularyWord } from "@/lib/types";

export type QuestionKind = "letter" | "word" | "letter_form";

export interface Choice {
  /** letters.id eller vocabulary.id */
  id: string;
  /** Det der vises på valg-kortet (bogstavform eller vokaliseret ord) */
  arabic: string;
  transliteration: string | null;
  /** Dansk betydning/navn — vises som forstærkning EFTER svar, aldrig som hint */
  danish: string;
  isCorrect: boolean;
}

export interface Question {
  kind: QuestionKind;
  /** Dansk instruktion, læses op af UI-tekst (dansk bærer instruktionen) */
  instructionDa: string;
  /**
   * Lyd-URL fra media-tabellen. For bogstaver garanterer DB-triggeren
   * trg_letters_audio_human at denne er menneskeligt optaget.
   * null = lyd ikke optaget endnu → UI viser tekst-fallback.
   */
  audioUrl: string | null;
  /** Tekst-fallback når lyd mangler (midlertidig indtil optagelser findes) */
  fallback: { titleDa: string; hintDa: string | null };
  register: "fusha" | "everyday";
  /** Kun sat for kind='letter_form' */
  formPosition: LetterForm | null;
  choices: Choice[];
}

/** Dansk navn for bogstav-positioner (teen-skind) */
export const FORM_LABEL_DA: Record<LetterForm, string> = {
  isolated: "alene",
  initial: "i starten af et ord",
  medial: "i midten af et ord",
  final: "i slutningen af et ord",
};

/**
 * Visuelle ligheds-grupper: bogstaver med samme grundform (rasm), der kun
 * adskilles af prikker. Bruges til at styre sværhedsgrad:
 *   - soft: distraktorer vælges fra ANDRE grupper (let at skelne)
 *   - teen: distraktorer vælges fra SAMME gruppe når muligt (svært)
 */
const SIMILARITY_GROUPS: string[][] = [
  ["ب", "ت", "ث", "ن", "ي"],
  ["ج", "ح", "خ"],
  ["د", "ذ"],
  ["ر", "ز"],
  ["س", "ش"],
  ["ص", "ض"],
  ["ط", "ظ"],
  ["ع", "غ"],
  ["ف", "ق"],
];

function groupOf(letter: string): string[] | null {
  return SIMILARITY_GROUPS.find((g) => g.includes(letter)) ?? null;
}

// ----------------------------------------------------------------------------
// Tilfældigheds-hjælpere (Fisher–Yates; ingen bias)
// ----------------------------------------------------------------------------

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ----------------------------------------------------------------------------
// Distraktor-udvælgelse
// ----------------------------------------------------------------------------

type Difficulty = "easy" | "mixed" | "hard";

function pickLetterDistractors(
  target: Letter,
  pool: readonly Letter[],
  count: number,
  difficulty: Difficulty,
): Letter[] {
  const others = pool.filter((l) => l.id !== target.id);
  const group = groupOf(target.letter);
  const sameGroup = group
    ? others.filter((l) => group.includes(l.letter))
    : [];
  const otherGroup = others.filter((l) => !sameGroup.includes(l));

  let ordered: Letter[];
  switch (difficulty) {
    case "easy":
      // Visuelt ulige først — barnet skal kunne lykkes
      ordered = [...shuffle(otherGroup), ...shuffle(sameGroup)];
      break;
    case "hard":
      // Visuelt lignende først — ب blandt ت ث ن
      ordered = [...shuffle(sameGroup), ...shuffle(otherGroup)];
      break;
    case "mixed":
      ordered = shuffle(others);
      break;
  }
  return ordered.slice(0, count);
}

// ----------------------------------------------------------------------------
// Spørgsmåls-byggere
// ----------------------------------------------------------------------------

export interface BuildInput {
  skin: AgeSkin;
  letters: readonly Letter[];
  vocabulary: readonly VocabularyWord[];
  /** media.id → offentlig URL (opslået af hooket) */
  audioUrlById: ReadonlyMap<string, string>;
}

function letterChoice(l: Letter, form: LetterForm, isCorrect: boolean): Choice {
  const arabic =
    form === "isolated"
      ? l.form_isolated
      : form === "initial"
        ? l.form_initial
        : form === "medial"
          ? l.form_medial
          : l.form_final;
  return {
    id: l.id,
    arabic,
    transliteration: null, // bogstavnavne transskriberes ikke; name_da bruges efter svar
    danish: l.name_da,
    isCorrect,
  };
}

function letterAudio(
  l: Letter,
  audioUrlById: ReadonlyMap<string, string>,
): string | null {
  // DB-garanti: hvis audio_media_id findes, er mediet menneskeligt optaget
  // (trg_letters_audio_human, fail-closed). Vi tilføjer ALDRIG syntetisk
  // fallback-lyd for bogstaver her — kerne-fusha er human-only (lyd-reglen).
  return l.audio_media_id
    ? (audioUrlById.get(l.audio_media_id) ?? null)
    : null;
}

function buildLetterQuestion(
  target: Letter,
  pool: readonly Letter[],
  choiceCount: number,
  difficulty: Difficulty,
  audioUrlById: ReadonlyMap<string, string>,
): Question {
  const distractors = pickLetterDistractors(
    target,
    pool,
    choiceCount - 1,
    difficulty,
  );
  return {
    kind: "letter",
    instructionDa: "Lyt … og find bogstavet!",
    audioUrl: letterAudio(target, audioUrlById),
    fallback: { titleDa: target.name_da, hintDa: target.sound_hint_da },
    register: "fusha",
    formPosition: null,
    choices: shuffle([
      letterChoice(target, "isolated", true),
      ...distractors.map((d) => letterChoice(d, "isolated", false)),
    ]),
  };
}

function buildWordQuestion(
  target: VocabularyWord,
  pool: readonly VocabularyWord[],
  choiceCount: number,
  audioUrlById: ReadonlyMap<string, string>,
): Question {
  // Distraktorer fra samme kategori når muligt (fx dyr blandt dyr) — det
  // holder spørgsmålet fair: barnet skelner på LYD/skrift, ikke på emne.
  const others = pool.filter((w) => w.id !== target.id);
  const sameCat = others.filter((w) => w.category === target.category);
  const rest = others.filter((w) => w.category !== target.category);
  const distractors = [...shuffle(sameCat), ...shuffle(rest)].slice(
    0,
    choiceCount - 1,
  );

  const toChoice = (w: VocabularyWord, isCorrect: boolean): Choice => ({
    id: w.id,
    arabic: w.word_ar,
    transliteration: w.transliteration,
    danish: w.word_da,
    isCorrect,
  });

  return {
    kind: "word",
    instructionDa: "Lyt … og find ordet!",
    audioUrl: target.audio_media_id
      ? (audioUrlById.get(target.audio_media_id) ?? null)
      : null,
    fallback: { titleDa: `“${target.word_da}” på arabisk`, hintDa: null },
    register: target.register,
    formPosition: null,
    choices: shuffle([
      toChoice(target, true),
      ...distractors.map((d) => toChoice(d, false)),
    ]),
  };
}

function buildLetterFormQuestion(
  target: Letter,
  pool: readonly Letter[],
  form: LetterForm,
  audioUrlById: ReadonlyMap<string, string>,
): Question {
  const distractors = pickLetterDistractors(target, pool, 3, "hard");
  return {
    kind: "letter_form",
    instructionDa: `Find ${target.name_da}, som det ser ud ${FORM_LABEL_DA[form]}`,
    audioUrl: letterAudio(target, audioUrlById),
    fallback: { titleDa: target.name_da, hintDa: target.sound_hint_da },
    register: "fusha",
    formPosition: form,
    choices: shuffle([
      letterChoice(target, form, true),
      ...distractors.map((d) => letterChoice(d, form, false)),
    ]),
  };
}

// ----------------------------------------------------------------------------
// Runde-bygning pr. aldersskind
// ----------------------------------------------------------------------------

/** Antal spørgsmål pr. skind — soft holder sig inden for 60–90 sek. */
export const ROUND_LENGTH: Record<AgeSkin, number> = {
  soft: 6,
  mid: 8,
  teen: 8,
};

export function buildRound(input: BuildInput): Question[] {
  const { skin, letters, vocabulary, audioUrlById } = input;
  if (letters.length < 4) return [];

  switch (skin) {
    case "soft": {
      // 3–6: kun bogstaver, 2 valg, begrænset pulje (de første 12 i
      // hija'i-orden) så mængden ikke overvælder, lette distraktorer.
      const pool = [...letters]
        .sort((a, b) => a.position - b.position)
        .slice(0, 12);
      return sample(pool, ROUND_LENGTH.soft).map((t) =>
        buildLetterQuestion(t, pool, 2, "easy", audioUrlById),
      );
    }

    case "mid": {
      // 7–10: 5 bogstav- + 3 ord-spørgsmål, 4 valg.
      const letterTargets = sample(letters, 5);
      const letterQs = letterTargets.map((t) =>
        buildLetterQuestion(t, letters, 4, "mixed", audioUrlById),
      );
      const wordQs =
        vocabulary.length >= 4
          ? sample(vocabulary, 3).map((t) =>
              buildWordQuestion(t, vocabulary, 4, audioUrlById),
            )
          : sample(letters, 3).map((t) =>
              buildLetterQuestion(t, letters, 4, "mixed", audioUrlById),
            );
      return shuffle([...letterQs, ...wordQs]);
    }

    case "teen": {
      // 11–14: bogstav-former. Kun forbinder-bogstaver giver meningsfuldt
      // forskellige start/midt-former; ikke-forbindere får slut-form.
      const forms: LetterForm[] = ["initial", "medial", "final"];
      return sample(letters, ROUND_LENGTH.teen).map((t, i) => {
        const form = t.is_connector ? forms[i % forms.length] : "final";
        return buildLetterFormQuestion(t, letters, form, audioUrlById);
      });
    }
  }
}
