/**
 * learning.test.ts — D2's tærskler og formuleringer.
 *
 * Disse tests dækker netop de forgreninger hvor en fejl er dyr: et barn
 * der fejlagtigt får at vide at det "kan" et bogstav, eller en forælder
 * der får en påstand om forveksling som tællerne ikke kan bære.
 */

import { describe, expect, it } from "vitest";
import { da } from "@/lib/i18n/da";
import type { Letter, VocabularyWord } from "@/lib/types";
import {
  KNOWN_RATE,
  MAX_STRUGGLES,
  MIN_SEEN,
  STRUGGLING_RATE,
  classifyStat,
  summarizeLearning,
  type ItemStat,
} from "./learning";

const m = da.dashboard;

function letter(id: string, glyph: string, position: number, nameDa = "Ba"): Letter {
  return {
    id,
    position,
    letter: glyph,
    name_ar: "باء",
    name_da: nameDa,
    sound_hint_da: "b",
    is_connector: true,
    form_isolated: glyph,
    form_initial: glyph,
    form_medial: glyph,
    form_final: glyph,
    audio_media_id: null,
    audio_media_id_male: null,
    level: 1,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function word(id: string, ar: string, da_: string, emoji: string | null = "🐫"): VocabularyWord {
  return {
    id,
    word_ar: ar,
    transliteration: "jamal",
    word_da: da_,
    category: "dyr",
    register: "fusha",
    first_letter_id: null,
    level: 1,
    emoji,
    image_media_id: null,
    audio_media_id: null,
    audio_media_id_male: null,
    is_published: true,
  } as VocabularyWord;
}

function stat(
  type: "letter" | "vocabulary",
  id: string,
  seen: number,
  correct: number,
): ItemStat {
  return { item_type: type, item_id: id, seen_count: seen, correct_count: correct };
}

describe("classifyStat — tærskler", () => {
  it("kræver MIN_SEEN visninger før noget klassificeres", () => {
    // 2 af 2 rigtige er 100 %, men for tyndt grundlag til at rose barnet
    expect(classifyStat(stat("letter", "a", MIN_SEEN - 1, MIN_SEEN - 1))).toBe("learning");
    // ... og 0 af 2 er for tyndt til at udpege det som et problem
    expect(classifyStat(stat("letter", "a", MIN_SEEN - 1, 0))).toBe("learning");
  });

  it("regner et item som kendt fra og med KNOWN_RATE", () => {
    expect(classifyStat(stat("letter", "a", 10, 10 * KNOWN_RATE))).toBe("known");
    expect(classifyStat(stat("letter", "a", 10, 10 * KNOWN_RATE - 1))).not.toBe("known");
  });

  it("regner et item som svært UNDER STRUGGLING_RATE, ikke ved", () => {
    expect(classifyStat(stat("letter", "a", 10, 10 * STRUGGLING_RATE - 1))).toBe("struggling");
    expect(classifyStat(stat("letter", "a", 10, 10 * STRUGGLING_RATE))).toBe("learning");
  });

  it("lader midterfeltet være neutralt — hverken rost eller udpeget", () => {
    expect(classifyStat(stat("letter", "a", 10, 5))).toBe("learning");
  });
});

describe("summarizeLearning — tælling", () => {
  const letters = [letter("l1", "ب", 2), letter("l2", "ت", 3), letter("l3", "م", 24)];
  const words = [word("w1", "جَمَل", "kamel"), word("w2", "بَاب", "dør")];

  it("bruger hele katalogerne som nævner, ikke kun det barnet har mødt", () => {
    const s = summarizeLearning([stat("letter", "l1", 5, 5)], letters, words, m);
    expect(s.letters).toEqual({ known: 1, total: 3 });
    expect(s.words).toEqual({ known: 0, total: 2 });
  });

  it("melder tom-tilstand når barnet ingen tællere har", () => {
    const s = summarizeLearning([], letters, words, m);
    expect(s.empty).toBe(true);
    expect(s.struggles).toHaveLength(0);
  });

  it("er ikke tom når der findes tællere, selv uden at noget er lært endnu", () => {
    const s = summarizeLearning([stat("letter", "l1", 1, 0)], letters, words, m);
    expect(s.empty).toBe(false);
    expect(s.letters.known).toBe(0);
  });

  it("lister kendte bogstaver i alfabetets rækkefølge, ikke i tællernes", () => {
    const s = summarizeLearning(
      [stat("letter", "l3", 5, 5), stat("letter", "l1", 5, 5)],
      letters,
      words,
      m,
    );
    expect(s.knownLetters).toEqual(["ب", "م"]);
  });

  it("springer ukendte item-id'er stille over (slettet indhold)", () => {
    const s = summarizeLearning([stat("letter", "findes-ikke", 9, 9)], letters, words, m);
    expect(s.letters.known).toBe(0);
    expect(s.struggles).toHaveLength(0);
  });
});

describe("summarizeLearning — 'her øver stadig'", () => {
  const letters = [letter("l1", "ب", 2), letter("l2", "ت", 3), letter("l3", "م", 24, "Mim")];
  const words = [word("w1", "جَمَل", "kamel")];

  it("siger 'driller begge' KUN når begge bogstaver i rasm-gruppen er svage", () => {
    const s = summarizeLearning(
      [stat("letter", "l1", 10, 1), stat("letter", "l2", 10, 1)],
      letters,
      words,
      m,
    );
    expect(s.struggles[0].text).toContain("driller begge");
  });

  it("siger kun 'ligner' når ét bogstav er svagt — påstår ingen forveksling vi ikke kan se", () => {
    const s = summarizeLearning([stat("letter", "l1", 10, 1)], letters, words, m);
    expect(s.struggles[0].text).toContain("ligner");
    expect(s.struggles[0].text).not.toContain("driller begge");
  });

  it("nævner ingen lignende bogstaver for et bogstav der står alene i skriften", () => {
    const s = summarizeLearning([stat("letter", "l3", 10, 1)], letters, words, m);
    expect(s.struggles[0].glyph).toBe("م");
    expect(s.struggles[0].text).toContain("Lidt mere øvelse");
  });

  it("sorterer svageste først", () => {
    const s = summarizeLearning(
      [stat("letter", "l1", 10, 3), stat("letter", "l3", 10, 0)],
      letters,
      words,
      m,
    );
    expect(s.struggles[0].glyph).toBe("م");
  });

  it("viser aldrig flere end MAX_STRUGGLES linjer", () => {
    const many = [
      letter("a", "ب", 2),
      letter("b", "ت", 3),
      letter("c", "ث", 4),
      letter("d", "ج", 5),
      letter("e", "ح", 6),
    ];
    const s = summarizeLearning(
      many.map((l) => stat("letter", l.id, 10, 0)),
      many,
      words,
      m,
    );
    expect(s.struggles).toHaveLength(MAX_STRUGGLES);
  });

  it("prioriterer bogstaver over ord i linjerne", () => {
    const s = summarizeLearning(
      [stat("vocabulary", "w1", 10, 0), stat("letter", "l1", 10, 2)],
      letters,
      words,
      m,
    );
    expect(s.struggles[0].glyph).toBe("ب");
  });

  it("bruger ordets emoji som anker og falder tilbage når den mangler", () => {
    const uden = [word("w2", "بَاب", "dør", null)];
    const s = summarizeLearning([stat("vocabulary", "w2", 10, 0)], letters, uden, m);
    expect(s.struggles[0].glyph).toBe("💬");
    expect(s.struggles[0].text).toContain("dør");
  });
});
