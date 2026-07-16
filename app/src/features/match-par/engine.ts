/**
 * Match-par — spilmotor (ren logik, ingen React).
 *
 * Ordforråds-motoren: barnet parrer dansk ↔ arabisk. Signaturen er
 * "lysbroer" — hvert rigtigt par tænder en bro af lys mellem kortene,
 * og dalen bliver gradvist lysere (platformens kernemetafor som mekanik).
 *
 * Tre aldersskind (ændrer HVORDAN, aldrig HVAD):
 *   soft (3–6): 3 par, ALLE kort synlige (ingen hukommelseskrav), emoji/
 *               billede bærer betydningen (ingen læsekrav), forkert par
 *               vipper blot blidt — runden ender altid i succes.
 *   mid  (7–10): 6 par som vend-og-find, transskription, XP + combo.
 *   teen (11–14): 8 par, ren arabisk skrift uden transskription,
 *                træk-tæller + præcision, strammere æstetik.
 *
 * MUREN: Dette spil lever udelukkende i Bogstavernes Dal (AI-tilladt
 * sprogdata). Det læser aldrig fra `content` og kan pr. konstruktion
 * ikke røre aqidah.
 */

import type { AgeSkin, VocabularyWord } from "@/lib/types";

export type CardSide = "da" | "ar";

export interface PairCard {
  /** Unik pr. kort: `${wordId}:${side}` */
  key: string;
  wordId: string;
  side: CardSide;
  word: VocabularyWord;
}

export interface SkinConfig {
  /** Antal par i en runde */
  pairs: number;
  /** Grid-kolonner */
  cols: number;
  /** true = vend-og-find (kort starter på bagsiden); false = alle synlige */
  flip: boolean;
  /** Transskription under arabisk (kombineres med profilens indstilling) */
  transliteration: boolean;
  /** Hvor længe et forkert par står åbent før det vendes tilbage (ms) */
  missRevealMs: number;
  /** XP pr. match + ekstra pr. combo-trin (0 i soft — dér er lyset lønnen) */
  xpBase: number;
  xpComboStep: number;
}

export const SKIN_CONFIG: Record<AgeSkin, SkinConfig> = {
  soft: {
    pairs: 3,
    cols: 2,
    flip: false,
    transliteration: false,
    missRevealMs: 0,
    xpBase: 0,
    xpComboStep: 0,
  },
  mid: {
    pairs: 6,
    cols: 3,
    flip: true,
    transliteration: true,
    missRevealMs: 750,
    xpBase: 10,
    xpComboStep: 2,
  },
  teen: {
    pairs: 8,
    cols: 4,
    flip: true,
    transliteration: false,
    missRevealMs: 650,
    xpBase: 15,
    xpComboStep: 3,
  },
};

/** XP for et match ved aktuel combo (combo = 1 for første match i stimen). */
export function xpForMatch(skin: AgeSkin, combo: number): number {
  const cfg = SKIN_CONFIG[skin];
  return cfg.xpBase + Math.max(0, combo - 1) * cfg.xpComboStep;
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
// Ord-udvælgelse pr. aldersskind
// ----------------------------------------------------------------------------

/**
 * Vælg rundens ord.
 *
 * soft: foretrækker ÉN sammenhængende kategori (fx kun dyr) — et lille,
 * trygt tema uden hukommelseskrav. mid/teen: blandede kategorier, så
 * barnet skelner på ordet selv, ikke på emnet.
 *
 * `category` kan tvinges udefra (fx fra lektions-navigationen); ellers
 * vælges den tilfældigt blandt kategorier med nok ord.
 */
export function pickRoundWords(
  skin: AgeSkin,
  vocabulary: readonly VocabularyWord[],
  category?: VocabularyWord["category"],
  /** Trin-tilstand: par-antal fra lesson_steps i stedet for skind-standard */
  pairsOverride?: number,
): VocabularyWord[] {
  const cfg = SKIN_CONFIG[skin];
  const wanted = pairsOverride ?? cfg.pairs;

  let pool: readonly VocabularyWord[] = vocabulary;
  if (category) {
    const inCat = vocabulary.filter((w) => w.category === category);
    if (inCat.length >= 2) pool = inCat;
  } else if (skin === "soft") {
    const byCategory = new Map<string, VocabularyWord[]>();
    for (const w of vocabulary) {
      const list = byCategory.get(w.category) ?? [];
      list.push(w);
      byCategory.set(w.category, list);
    }
    const richEnough = [...byCategory.values()].filter(
      (list) => list.length >= wanted,
    );
    if (richEnough.length > 0) {
      pool = richEnough[Math.floor(Math.random() * richEnough.length)];
    }
  }

  // Færre ord end ønsket (fx smal kategori) → mindre runde frem for fejl.
  return sample(pool, Math.min(wanted, pool.length));
}

/** Byg det blandede kort-dæk: to kort (da + ar) pr. ord. */
export function buildDeck(words: readonly VocabularyWord[]): PairCard[] {
  const deck: PairCard[] = [];
  for (const w of words) {
    deck.push({ key: `${w.id}:da`, wordId: w.id, side: "da", word: w });
    deck.push({ key: `${w.id}:ar`, wordId: w.id, side: "ar", word: w });
  }
  return shuffle(deck);
}

/** Er de to kort et gyldigt par? (samme ord, modsatte sider) */
export function isMatch(a: PairCard, b: PairCard): boolean {
  return a.wordId === b.wordId && a.side !== b.side;
}
