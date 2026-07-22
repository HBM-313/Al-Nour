import { describe, expect, it } from "vitest";
import type { Letter, LessonStepParams, VocabularyWord } from "@/lib/types";
import {
  FORM_LABEL_DA,
  ROUND_LENGTH,
  buildRound,
  buildStepRound,
  shuffle,
} from "./engine";

// ----------------------------------------------------------------------------
// Fixture-hjælpere
// ----------------------------------------------------------------------------

let letterCounter = 0;
function makeLetter(overrides: Partial<Letter> = {}): Letter {
  letterCounter += 1;
  const base = String.fromCharCode(0x0621 + letterCounter); // vilkårlige arabiske tegn
  return {
    id: `letter-${letterCounter}`,
    position: letterCounter,
    letter: base,
    name_ar: `اسم-${letterCounter}`,
    name_da: `navn-${letterCounter}`,
    sound_hint_da: `lyd-${letterCounter}`,
    is_connector: true,
    form_isolated: base,
    form_initial: base,
    form_medial: base,
    form_final: base,
    audio_media_id: null,
    audio_media_id_male: null,
    level: 1,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Bygger `count` bogstaver med GARANTERET fortløbende positioner 1..count.
 * (Bevidst uafhængig af den globale id-tæller i makeLetter, som ellers ville
 * give voksende positioner på tværs af hele testfilen, ikke pr. kald.)
 */
function makeLetters(count: number): Letter[] {
  return Array.from({ length: count }, (_, i) => makeLetter({ position: i + 1 }));
}

let wordCounter = 0;
function makeWord(overrides: Partial<VocabularyWord> = {}): VocabularyWord {
  wordCounter += 1;
  return {
    id: `word-${wordCounter}`,
    word_ar: "كَلِمَة",
    transliteration: "kalima",
    word_da: `ord-${wordCounter}`,
    category: "dyr",
    register: "everyday",
    first_letter_id: null,
    level: 1,
    emoji: null,
    image_media_id: null,
    audio_media_id: null,
    audio_media_id_male: null,
    is_published: true,
    suggested_by: "human",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeStep(overrides: Partial<LessonStepParams> = {}): LessonStepParams {
  return {
    letterPositions: [1, 2],
    includeReview: false,
    difficulty: "easy",
    questionCount: 6,
    formsMode: false,
    ...overrides,
  };
}

// ----------------------------------------------------------------------------
// FORM_LABEL_DA / shuffle
// ----------------------------------------------------------------------------

describe("FORM_LABEL_DA", () => {
  it("har et dansk label for alle fire bogstav-positioner", () => {
    expect(Object.keys(FORM_LABEL_DA).sort()).toEqual(
      ["final", "initial", "isolated", "medial"].sort(),
    );
    expect(FORM_LABEL_DA.initial).toBe("i starten af et ord");
  });
});

describe("shuffle (lyt-og-find)", () => {
  it("bevarer alle elementer", () => {
    const input = ["a", "b", "c", "d"];
    const out = shuffle(input);
    expect([...out].sort()).toEqual([...input].sort());
  });
});

// ----------------------------------------------------------------------------
// buildRound
// ----------------------------------------------------------------------------

describe("buildRound", () => {
  it("returnerer tom runde hvis der er færre end 4 bogstaver", () => {
    const result = buildRound({
      skin: "soft",
      letters: makeLetters(3),
      vocabulary: [],
      audioUrlById: new Map(),
    });
    expect(result).toEqual([]);
  });

  it("soft: bygger præcis ROUND_LENGTH.soft bogstav-spørgsmål med 2 valg", () => {
    const letters = makeLetters(20);
    const result = buildRound({
      skin: "soft",
      letters,
      vocabulary: [],
      audioUrlById: new Map(),
    });

    expect(result).toHaveLength(ROUND_LENGTH.soft);
    for (const q of result) {
      expect(q.kind).toBe("letter");
      expect(q.choices).toHaveLength(2);
      expect(q.choices.filter((c) => c.isCorrect)).toHaveLength(1);
    }
  });

  it("soft: bruger kun de første 12 bogstaver i hija'i-orden (positions-sorteret)", () => {
    const letters = makeLetters(20); // positions 1..20
    // Kør flere gange for at være sikker på at ALDRIG se et sent bogstav.
    for (let i = 0; i < 15; i++) {
      const result = buildRound({
        skin: "soft",
        letters,
        vocabulary: [],
        audioUrlById: new Map(),
      });
      for (const q of result) {
        const correct = q.choices.find((c) => c.isCorrect)!;
        const letter = letters.find((l) => l.id === correct.id)!;
        expect(letter.position).toBeLessThanOrEqual(12);
      }
    }
  });

  it("mid: bygger ROUND_LENGTH.mid spørgsmål med 4 valg, blanding af bogstav/ord", () => {
    const letters = makeLetters(20);
    const vocabulary = Array.from({ length: 10 }, () => makeWord());
    const result = buildRound({
      skin: "mid",
      letters,
      vocabulary,
      audioUrlById: new Map(),
    });

    expect(result).toHaveLength(ROUND_LENGTH.mid);
    for (const q of result) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter((c) => c.isCorrect)).toHaveLength(1);
    }
    const kinds = new Set(result.map((q) => q.kind));
    expect(kinds.has("letter")).toBe(true);
    expect(kinds.has("word")).toBe(true);
  });

  it("mid: falder tilbage til rene bogstav-spørgsmål hvis vokabularet er for lille", () => {
    const letters = makeLetters(20);
    const result = buildRound({
      skin: "mid",
      letters,
      vocabulary: [], // < 4 ord
      audioUrlById: new Map(),
    });
    expect(result).toHaveLength(ROUND_LENGTH.mid);
    expect(result.every((q) => q.kind === "letter")).toBe(true);
  });

  it("teen: bygger bogstav-form-spørgsmål med formPosition sat", () => {
    const letters = makeLetters(20);
    const result = buildRound({
      skin: "teen",
      letters,
      vocabulary: [],
      audioUrlById: new Map(),
    });
    expect(result).toHaveLength(ROUND_LENGTH.teen);
    for (const q of result) {
      expect(q.kind).toBe("letter_form");
      expect(q.formPosition).not.toBeNull();
      expect(q.choices).toHaveLength(4);
    }
  });

  it("teen: ikke-forbinder-bogstaver får altid slut-formen", () => {
    const letters = makeLetters(20).map((l) => ({ ...l, is_connector: false }));
    const result = buildRound({
      skin: "teen",
      letters,
      vocabulary: [],
      audioUrlById: new Map(),
    });
    expect(result.every((q) => q.formPosition === "final")).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Distraktor-sværhedsgrad — bruger de REELLE similarity-grupper fra domænet
// ----------------------------------------------------------------------------

describe("buildRound — distraktor-sværhedsgrad", () => {
  // ب ت ث ن ي er én visuel ligheds-gruppe (kun prikker adskiller dem).
  const groupLetters = ["ب", "ت", "ث", "ن", "ي"].map((ch) =>
    makeLetter({ letter: ch, position: letterCounter, is_connector: true }),
  );
  // Rigeligt med visuelt ULIGE bogstaver til at fylde "easy"-distraktorer.
  const unrelatedLetters = makeLetters(8).map((l) => ({
    ...l,
    letter: "م", // uden for alle similarity-grupper
  }));

  it("soft (easy): distraktoren er IKKE fra målets ligheds-gruppe når nok alternativer findes", () => {
    const pool = [...groupLetters, ...unrelatedLetters];
    for (let i = 0; i < 10; i++) {
      const result = buildRound({
        skin: "soft",
        letters: pool,
        vocabulary: [],
        audioUrlById: new Map(),
      });
      for (const q of result) {
        const correct = q.choices.find((c) => c.isCorrect)!;
        const wrong = q.choices.find((c) => !c.isCorrect)!;
        const targetLetter = pool.find((l) => l.id === correct.id)!;
        const distractorLetter = pool.find((l) => l.id === wrong.id)!;
        if (groupLetters.some((g) => g.id === targetLetter.id)) {
          expect(groupLetters.map((g) => g.letter)).not.toContain(
            distractorLetter.letter === targetLetter.letter
              ? "__umulig__" // targetten selv er aldrig valgt som distraktor
              : distractorLetter.letter,
          );
        }
      }
    }
  });
});

// ----------------------------------------------------------------------------
// Lyd-fallback-kæde: medie-fil vinder, ellers ttsText, altid tekst-fallback
// ----------------------------------------------------------------------------

describe("Lyd-fallback-kæde", () => {
  it("bruger medie-URL når audio_media_id findes i kortet", () => {
    const letters = makeLetters(20);
    const target = { ...letters[0], audio_media_id: "media-1" };
    const withTarget = [target, ...letters.slice(1)];
    const audioUrlById = new Map([["media-1", "https://cdn.test/letter1.mp3"]]);

    const result = buildRound({
      skin: "soft",
      letters: withTarget,
      vocabulary: [],
      audioUrlById,
    });

    // Find evt. spørgsmål om target — soft bruger kun de 12 første positioner
    const q = result.find((r) => r.choices.some((c) => c.id === target.id && c.isCorrect));
    if (q) {
      expect(q.audioUrl).toBe("https://cdn.test/letter1.mp3");
      expect(q.ttsText).toBe(target.name_ar);
    }
  });

  it("falder tilbage til ttsText (browser-TTS) når ingen medie-fil findes endnu", () => {
    const letters = makeLetters(20); // ingen har audio_media_id sat
    const result = buildRound({
      skin: "soft",
      letters,
      vocabulary: [],
      audioUrlById: new Map(), // tomt opslag
    });
    for (const q of result) {
      expect(q.audioUrl).toBeNull();
      expect(q.ttsText).not.toBeNull();
      expect(q.ttsText).not.toBe("");
    }
  });

  it("har altid en tekst-fallback (titleDa) uanset lyd-status", () => {
    const letters = makeLetters(20);
    const result = buildRound({
      skin: "soft",
      letters,
      vocabulary: [],
      audioUrlById: new Map(),
    });
    for (const q of result) {
      expect(q.fallback.titleDa).toBeTruthy();
    }
  });

  it("ordforråds-spørgsmål bruger word_ar som ttsText og respekterer register", () => {
    const letters = makeLetters(20);
    const vocabulary = Array.from({ length: 6 }, () =>
      makeWord({ register: "fusha" }),
    );
    const result = buildRound({
      skin: "mid",
      letters,
      vocabulary,
      audioUrlById: new Map(),
    });
    const wordQs = result.filter((q) => q.kind === "word");
    expect(wordQs.length).toBeGreaterThan(0);
    for (const q of wordQs) {
      expect(q.register).toBe("fusha");
    }
  });
});

// ----------------------------------------------------------------------------
// buildStepRound — lektions-trin-baseret runde
// ----------------------------------------------------------------------------

describe("buildStepRound", () => {
  it("returnerer tom runde hvis trinnets bogstav-positioner ikke findes i letters", () => {
    const letters = makeLetters(10); // positions 1..10
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary: [], audioUrlById: new Map() },
      makeStep({ letterPositions: [999] }),
    );
    expect(result).toEqual([]);
  });

  it("bygger kun letter_form-spørgsmål når formsMode=true", () => {
    const letters = makeLetters(10);
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary: [], audioUrlById: new Map() },
      makeStep({ letterPositions: [1, 2], formsMode: true, questionCount: 4 }),
    );
    expect(result).toHaveLength(4);
    expect(result.every((q) => q.kind === "letter_form")).toBe(true);
  });

  it("soft: blander aldrig ordforråds-spørgsmål ind, selv med includeReview og nok ord", () => {
    const letters = makeLetters(10);
    const vocabulary = Array.from({ length: 10 }, () =>
      makeWord({ first_letter_id: letters[0].id }),
    );
    const result = buildStepRound(
      { skin: "soft", letters, vocabulary, audioUrlById: new Map() },
      makeStep({
        letterPositions: [1],
        includeReview: true,
        questionCount: 6,
      }),
    );
    expect(result.every((q) => q.kind !== "word")).toBe(true);
    // soft skal have 2 valg pr. spørgsmål, ikke 4.
    for (const q of result) expect(q.choices).toHaveLength(2);
  });

  it("mid+includeReview: blander ordforråds-spørgsmål ind når nok lærte ord findes", () => {
    const letters = makeLetters(10);
    const vocabulary = Array.from({ length: 8 }, () =>
      makeWord({ first_letter_id: letters[0].id }),
    );
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary, audioUrlById: new Map() },
      makeStep({
        letterPositions: [2],
        includeReview: true,
        questionCount: 9,
      }),
    );
    const wordQs = result.filter((q) => q.kind === "word");
    expect(wordQs.length).toBeGreaterThan(0);
    expect(wordQs.length).toBeLessThanOrEqual(3); // maks 3 pr. definition
  });

  it("uden includeReview blandes ordforråd aldrig ind, uanset skin", () => {
    const letters = makeLetters(10);
    const vocabulary = Array.from({ length: 8 }, () =>
      makeWord({ first_letter_id: letters[0].id }),
    );
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary, audioUrlById: new Map() },
      makeStep({
        letterPositions: [1],
        includeReview: false,
        questionCount: 6,
      }),
    );
    expect(result.every((q) => q.kind !== "word")).toBe(true);
  });

  it("distraktor-puljen udvides nødtvunget hvis den lærte pulje er for lille (<2)", () => {
    // Kun ét bogstav lært endnu, ingen review — pool ville ellers være 1
    // element, hvilket ikke giver nok distraktorer.
    const letters = makeLetters(10);
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary: [], audioUrlById: new Map() },
      makeStep({
        letterPositions: [letters[0].position],
        includeReview: false,
        questionCount: 3,
      }),
    );
    for (const q of result) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter((c) => c.isCorrect)).toHaveLength(1);
    }
  });

  it("questionCount respekteres som minimum 2, selv hvis trin beder om mindre", () => {
    const letters = makeLetters(10);
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary: [], audioUrlById: new Map() },
      makeStep({ letterPositions: [1], questionCount: 0 }),
    );
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("mål-bogstaverne går på skift (rundgang) så alle nye bogstaver øves", () => {
    const letters = makeLetters(10);
    const target1 = letters[0];
    const target2 = letters[1];
    const result = buildStepRound(
      { skin: "mid", letters, vocabulary: [], audioUrlById: new Map() },
      makeStep({
        letterPositions: [target1.position, target2.position],
        questionCount: 6,
      }),
    );
    const targetIds = new Set(
      result.map((q) => q.choices.find((c) => c.isCorrect)!.id),
    );
    expect(targetIds.has(target1.id)).toBe(true);
    expect(targetIds.has(target2.id)).toBe(true);
  });
});
