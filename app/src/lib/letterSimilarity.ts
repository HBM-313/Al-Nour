/**
 * letterSimilarity — visuelle ligheds-grupper for det arabiske alfabet.
 *
 * Bogstaver med samme grundform (rasm), der kun adskilles af prikker eller
 * små detaljer. Dette er ren domæne-viden om arabisk skrift — ikke spil-
 * logik — og bruges nu to steder:
 *
 *   1. `features/lyt-og-find/engine.ts` — distraktor-sværhedsgrad
 *      (soft: distraktorer fra ANDRE grupper; teen: fra SAMME gruppe).
 *   2. `features/dashboard/learning.ts` — D2's "her øver barnet stadig",
 *      hvor gruppen forklarer forælderen HVORFOR et bogstav driller.
 *
 * Grupperne bor her, fordi de to steder ALTID skal være enige: siger
 * spillet at ب og ت ligner hinanden, skal dashboardet sige det samme.
 * Flyttet hertil ved Leverance D2 (uændret indhold).
 */

export const SIMILARITY_GROUPS: readonly (readonly string[])[] = [
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

/** Gruppen `letter` tilhører (inkl. bogstavet selv), eller null hvis det står alene. */
export function groupOf(letter: string): readonly string[] | null {
  return SIMILARITY_GROUPS.find((g) => g.includes(letter)) ?? null;
}

/** De ANDRE bogstaver der ligner `letter`. Tom liste hvis bogstavet står alene. */
export function similarTo(letter: string): string[] {
  const group = groupOf(letter);
  if (!group) return [];
  return group.filter((l) => l !== letter);
}
