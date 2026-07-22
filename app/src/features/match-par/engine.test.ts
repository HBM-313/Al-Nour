import { describe, expect, it } from "vitest";
import type { VocabularyWord } from "@/lib/types";
import {
  SKIN_CONFIG,
  buildDeck,
  isMatch,
  pickRoundWords,
  shuffle,
  xpForMatch,
} from "./engine";

// ----------------------------------------------------------------------------
// Fixture-hjælper
// ----------------------------------------------------------------------------

let idCounter = 0;
function makeWord(overrides: Partial<VocabularyWord> = {}): VocabularyWord {
  idCounter += 1;
  return {
    id: `word-${idCounter}`,
    word_ar: "كَلِمَة",
    transliteration: "kalima",
    word_da: `ord-${idCounter}`,
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

/** Ord i en given kategori, med valgfri first_letter_id-tildeling. */
function wordsIn(
  category: VocabularyWord["category"],
  count: number,
  firstLetterId: string | null = null,
): VocabularyWord[] {
  return Array.from({ length: count }, () =>
    makeWord({ category, first_letter_id: firstLetterId }),
  );
}

// ----------------------------------------------------------------------------
// SKIN_CONFIG / xpForMatch
// ----------------------------------------------------------------------------

describe("SKIN_CONFIG", () => {
  it("har stigende par-antal med alder (soft < mid < teen)", () => {
    expect(SKIN_CONFIG.soft.pairs).toBe(3);
    expect(SKIN_CONFIG.mid.pairs).toBe(6);
    expect(SKIN_CONFIG.teen.pairs).toBe(8);
  });

  it("soft har ingen XP — lyset er lønnen, ikke tal", () => {
    expect(SKIN_CONFIG.soft.xpBase).toBe(0);
    expect(SKIN_CONFIG.soft.xpComboStep).toBe(0);
  });
});

describe("xpForMatch", () => {
  it("giver kun basis-XP ved combo 1", () => {
    expect(xpForMatch("mid", 1)).toBe(SKIN_CONFIG.mid.xpBase);
    expect(xpForMatch("teen", 1)).toBe(SKIN_CONFIG.teen.xpBase);
  });

  it("lægger combo-bonus oveni for hvert trin over 1", () => {
    // mid: base 10, +2 pr. combo-trin
    expect(xpForMatch("mid", 3)).toBe(10 + 2 * 2);
    expect(xpForMatch("teen", 4)).toBe(15 + 3 * 3);
  });

  it("giver aldrig negativ bonus for combo under 1 (0 eller negativ)", () => {
    expect(xpForMatch("mid", 0)).toBe(SKIN_CONFIG.mid.xpBase);
    expect(xpForMatch("mid", -5)).toBe(SKIN_CONFIG.mid.xpBase);
  });

  it("soft giver altid 0 XP uanset combo", () => {
    expect(xpForMatch("soft", 1)).toBe(0);
    expect(xpForMatch("soft", 10)).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// shuffle
// ----------------------------------------------------------------------------

describe("shuffle", () => {
  it("bevarer alle elementer (samme multisæt, ny rækkefølge tilladt)", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it("muterer ikke det oprindelige array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it("håndterer tomt array uden fejl", () => {
    expect(shuffle([])).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// buildDeck / isMatch
// ----------------------------------------------------------------------------

describe("buildDeck", () => {
  it("bygger to kort (da + ar) pr. ord", () => {
    const words = wordsIn("dyr", 4);
    const deck = buildDeck(words);
    expect(deck).toHaveLength(words.length * 2);
  });

  it("hvert ord har præcis ét 'da'- og ét 'ar'-kort med unik nøgle", () => {
    const words = wordsIn("dyr", 5);
    const deck = buildDeck(words);
    const keys = new Set(deck.map((c) => c.key));
    expect(keys.size).toBe(deck.length); // alle nøgler unikke

    for (const w of words) {
      const cards = deck.filter((c) => c.wordId === w.id);
      expect(cards).toHaveLength(2);
      expect(cards.map((c) => c.side).sort()).toEqual(["ar", "da"]);
    }
  });
});

describe("isMatch", () => {
  it("er sandt for samme ord, modsatte sider", () => {
    const words = wordsIn("dyr", 1);
    const deck = buildDeck(words);
    const [a, b] = deck;
    expect(isMatch(a, b)).toBe(true);
  });

  it("er falsk for samme ord, samme side", () => {
    const words = wordsIn("dyr", 1);
    const [w] = words;
    const cardDa1 = { key: "x1", wordId: w.id, side: "da" as const, word: w };
    const cardDa2 = { key: "x2", wordId: w.id, side: "da" as const, word: w };
    expect(isMatch(cardDa1, cardDa2)).toBe(false);
  });

  it("er falsk for forskellige ord, uanset side", () => {
    const words = wordsIn("dyr", 2);
    const deck = buildDeck(words);
    const cardA = deck.find((c) => c.wordId === words[0].id && c.side === "da")!;
    const cardB = deck.find((c) => c.wordId === words[1].id && c.side === "ar")!;
    expect(isMatch(cardA, cardB)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// pickRoundWords — inkl. REGRESSIONSTEST for kategori-tærskel-fejlen
// (session 5: smalle kategorier som hjem/hilsner/krop kunne ALDRIG vælges,
// fordi tærsklen krævede >= hele rundens ordantal i én kategori)
// ----------------------------------------------------------------------------

describe("pickRoundWords — smalle kategorier (kategori-tærskel-regression)", () => {
  it("REGRESSION: en smal kategori (5 ord) skal kunne vælges når runden beder om 6, med standard-tærsklen", () => {
    // Dette er selve fejlen fra session 5: pairsOverride=6 (fx et tema-trin),
    // men 'hjem' har kun 5 ord. Med den GAMLE logik (tærskel = wanted = 6)
    // ville 'hjem' ALDRIG kvalificere sig, uanset hvor mange runder der spilles.
    // Standard-tærsklen er nu Math.min(3, wanted) = 3, så 5 >= 3 kvalificerer.
    const hjem = wordsIn("hjem", 5);
    const dyr = wordsIn("dyr", 2); // for lille til at kvalificere (< 3)
    const vocabulary = [...hjem, ...dyr];

    // Ingen options.minCategorySize angivet — tester DEFAULT-værdien direkte.
    const result = pickRoundWords("soft", vocabulary, undefined, 6);

    expect(result.chosenCategory).toBe("hjem");
    // Færre ord end ønsket i kategorien → mindre runde, ikke fejl/tom runde.
    expect(result.words).toHaveLength(5);
    expect(result.words.every((w) => w.category === "hjem")).toBe(true);
  });

  it("REGRESSION-modbevis: genindføres den gamle tærskel (== wanted), forsvinder den smalle kategori igen", () => {
    // Beviser at testen ovenfor rent faktisk måler det den påstår: tvinger vi
    // minCategorySize op til at kræve hele rundeantallet (den gamle fejl-
    // formel), falder 'hjem' (5 ord) ud af kandidatlisten, og funktionen
    // falder tilbage til hele vokabularet (chosenCategory bliver null).
    const hjem = wordsIn("hjem", 5);
    const dyr = wordsIn("dyr", 2);
    const vocabulary = [...hjem, ...dyr];

    const wanted = 6;
    const result = pickRoundWords("soft", vocabulary, undefined, wanted, {
      minCategorySize: wanted, // simulerer den gamle, forkerte tærskel
    });

    expect(result.chosenCategory).toBeNull();
  });

  it("en kategori under selv den relakserede tærskel kvalificerer stadig ikke", () => {
    const hjem = wordsIn("hjem", 2); // under default-tærsklen på 3
    const dyr = wordsIn("dyr", 2);
    const vocabulary = [...hjem, ...dyr];

    const result = pickRoundWords("soft", vocabulary, undefined, 6);
    expect(result.chosenCategory).toBeNull();
  });
});

describe("pickRoundWords — preferLetterIds", () => {
  it("foretrækker kategorier der indeholder ord fra lektionens nye bogstaver", () => {
    const dyr = wordsIn("dyr", 4, "letter-alif");
    const mad = wordsIn("mad", 4, "letter-ba"); // andet bogstav
    const vocabulary = [...dyr, ...mad];

    const result = pickRoundWords("soft", vocabulary, undefined, 3, {
      preferLetterIds: new Set(["letter-alif"]),
    });

    expect(result.chosenCategory).toBe("dyr");
  });

  it("falder tilbage til alle kvalificerende kategorier hvis ingen matcher preferLetterIds", () => {
    const dyr = wordsIn("dyr", 4, "letter-alif");
    const mad = wordsIn("mad", 4, "letter-ba");
    const vocabulary = [...dyr, ...mad];

    const result = pickRoundWords("soft", vocabulary, undefined, 3, {
      preferLetterIds: new Set(["letter-som-ikke-findes"]),
    });

    // Begge kategorier er stadig gyldige kandidater — vælger én af dem.
    expect(["dyr", "mad"]).toContain(result.chosenCategory);
  });
});

describe("pickRoundWords — avoidCategory", () => {
  it("undgår sidste rundes kategori når der findes et alternativ", () => {
    const dyr = wordsIn("dyr", 4);
    const mad = wordsIn("mad", 4);
    const vocabulary = [...dyr, ...mad];

    // Kør mange gange for at udelukke tilfældigt "held" — avoidCategory
    // skal ALDRIG returnere den undgåede kategori når et alternativ findes.
    for (let i = 0; i < 30; i++) {
      const result = pickRoundWords("soft", vocabulary, undefined, 3, {
        avoidCategory: "dyr",
      });
      expect(result.chosenCategory).toBe("mad");
    }
  });

  it("bruger alligevel den undgåede kategori hvis den er eneste kandidat", () => {
    const dyr = wordsIn("dyr", 4);
    const vocabulary = [...dyr];

    const result = pickRoundWords("soft", vocabulary, undefined, 3, {
      avoidCategory: "dyr",
    });
    expect(result.chosenCategory).toBe("dyr");
  });
});

describe("pickRoundWords — eksplicit kategori-parameter", () => {
  it("bruger den angivne kategori når den har nok ord (>= 2)", () => {
    const dyr = wordsIn("dyr", 4);
    const mad = wordsIn("mad", 4);
    const vocabulary = [...dyr, ...mad];

    const result = pickRoundWords("mid", vocabulary, "mad", 3);
    expect(result.words.every((w) => w.category === "mad")).toBe(true);
  });

  it("falder tilbage til hele vokabularet hvis den angivne kategori har < 2 ord", () => {
    const dyr = wordsIn("dyr", 4);
    const mad = wordsIn("mad", 1); // for lidt
    const vocabulary = [...dyr, ...mad];

    const result = pickRoundWords("mid", vocabulary, "mad", 3);
    // Pool falder tilbage til hele vocabulary (5 ord) — ordene kan komme
    // fra begge kategorier.
    expect(result.words.length).toBeGreaterThan(0);
    expect(
      result.words.every((w) => vocabulary.some((v) => v.id === w.id)),
    ).toBe(true);
  });
});

describe("pickRoundWords — mid/teen (ingen tema-kategori-logik)", () => {
  it("mid blander kategorier og ignorerer preferLetterIds/avoidCategory", () => {
    const dyr = wordsIn("dyr", 3);
    const mad = wordsIn("mad", 3);
    const vocabulary = [...dyr, ...mad];

    const result = pickRoundWords("mid", vocabulary, undefined, 4);
    expect(result.chosenCategory).toBeNull();
    expect(result.words).toHaveLength(4);
  });
});

describe("pickRoundWords — antal ord", () => {
  it("bruger skindets standard-par-antal når pairsOverride udelades", () => {
    const vocabulary = wordsIn("dyr", 10);
    const result = pickRoundWords("mid", vocabulary);
    expect(result.words).toHaveLength(SKIN_CONFIG.mid.pairs);
  });

  it("returnerer aldrig flere ord end puljen indeholder", () => {
    const vocabulary = wordsIn("dyr", 2);
    const result = pickRoundWords("teen", vocabulary, undefined, 8);
    expect(result.words.length).toBeLessThanOrEqual(2);
  });

  it("returnerer ingen dubletter i samme runde", () => {
    const vocabulary = wordsIn("dyr", 10);
    const result = pickRoundWords("mid", vocabulary, undefined, 6);
    const ids = result.words.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
