/**
 * Tegn Bogstavet — tracing-kerne (ren logik, ingen React).
 *
 * Metode: pixel-dækning. Bogstavet rasteriseres fra fonten til et offscreen
 * canvas; glyffens synlige pixels samples til et gitter af "lyspunkter".
 * Barnets streger "tænder" de punkter, penslen rammer. Dækning = tændte
 * punkter / alle punkter. Det virker for alle 28 bogstaver × 4 former uden
 * håndtegnede streg-data, og skalerer automatisk med fonten.
 *
 * MUREN: ren sprogdata (letters-tabellen, Bogstavernes Dal, AI-tilladt).
 * Rører aldrig content/aqidah.
 */

export interface GlyphSample {
  x: number;
  y: number;
}

export interface GlyphMap {
  /** Alle lyspunkter i canvas-koordinater */
  samples: GlyphSample[];
  /** Indeks i `samples` pr. spatial bucket — hurtige radius-opslag */
  buckets: Map<number, number[]>;
  bucketSize: number;
  cols: number;
  /** Punktet hvor barnet bør starte (mest til højre — arabisk skrives RTL) */
  startHint: GlyphSample | null;
  /** Glyffens bounding box i canvas-koordinater */
  bounds: { x: number; y: number; w: number; h: number };
}

/** Afstand mellem sample-punkter i px — lavere = mere præcis, dyrere */
const SAMPLE_STEP = 6;
const BUCKET_SIZE = 32;

/**
 * Beregn font-størrelsen for en glyf ved en given base-skala.
 * Deles af buildGlyphMap og TraceCanvas' silhuet-tegning, så dæknings-kortet
 * ALTID matcher det viste bogstav 1:1 (ellers passer dækningen ikke).
 *
 * `baseScale` styres pr. aldersskind (se SKIN_TUNING.fontScale): større
 * bogstav for de mindste (nemmere at fylde ud med tykke fingre), mindre for
 * de ældre (mere præcist). Penslen udledes bagefter af stregbredden, se
 * deriveBrushRadius — så én streg langs midten fylder bogstavet ud.
 */
export function fitGlyphFontSize(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  width: number,
  height: number,
  fontFamily: string,
  baseScale: number,
): number {
  let fontSize = Math.floor(height * baseScale);
  for (; fontSize > 12; fontSize -= 6) {
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(glyph).width <= width * 0.82) break;
  }
  return fontSize;
}

/**
 * Rasterisér en glyf og byg dæknings-kortet.
 * Fonten skal være færdigindlæst (await document.fonts.load(...)) inden kald,
 * ellers måles der mod en fallback-font.
 *
 * `baseScale` = aldersskindets fontScale (se SKIN_TUNING). Skal matche den
 * skala TraceCanvas tegner silhuetten med.
 */
export function buildGlyphMap(
  glyph: string,
  width: number,
  height: number,
  fontFamily: string,
  baseScale = 0.72,
): GlyphMap {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyMap();

  // Font-størrelse styret af aldersskindets skala (samme udregning som canvas)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = fitGlyphFontSize(
    ctx,
    glyph,
    width,
    height,
    fontFamily,
    baseScale,
  );
  ctx.font = `600 ${fontSize}px ${fontFamily}`;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillText(glyph, width / 2, height / 2);

  const data = ctx.getImageData(0, 0, width, height).data;
  const samples: GlyphSample[] = [];
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;

  for (let y = SAMPLE_STEP / 2; y < height; y += SAMPLE_STEP) {
    for (let x = SAMPLE_STEP / 2; x < width; x += SAMPLE_STEP) {
      const alpha = data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3];
      if (alpha > 96) {
        samples.push({ x, y });
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Spatial buckets
  const cols = Math.ceil(width / BUCKET_SIZE);
  const buckets = new Map<number, number[]>();
  samples.forEach((s, i) => {
    const key =
      Math.floor(s.y / BUCKET_SIZE) * cols + Math.floor(s.x / BUCKET_SIZE);
    const arr = buckets.get(key);
    if (arr) arr.push(i);
    else buckets.set(key, [i]);
  });

  // Start-hint: det øverste punkt i glyffens højre fjerdedel (arabisk = RTL).
  // Heuristik, ikke streg-orden — men peger barnet det rigtige sted hen.
  let startHint: GlyphSample | null = null;
  const rightEdge = maxX - (maxX - minX) * 0.25;
  for (const s of samples) {
    if (s.x >= rightEdge && (!startHint || s.y < startHint.y)) startHint = s;
  }

  return {
    samples,
    buckets,
    bucketSize: BUCKET_SIZE,
    cols,
    startHint,
    bounds: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
  };
}

function emptyMap(): GlyphMap {
  return {
    samples: [],
    buckets: new Map(),
    bucketSize: BUCKET_SIZE,
    cols: 0,
    startHint: null,
    bounds: { x: 0, y: 0, w: 0, h: 0 },
  };
}

/**
 * Fremskridts-tracker for én glyf: tænder lyspunkter inden for pensel-radius
 * og holder regnskab med dækning og streger uden for bogstavet.
 */
export class TraceProgress {
  private covered: Set<number> = new Set();
  private insideMoves = 0;
  private outsideMoves = 0;

  private map: GlyphMap;
  private brushRadius: number;

  constructor(map: GlyphMap, brushRadius: number) {
    this.map = map;
    this.brushRadius = brushRadius;
  }

  /**
   * Registrér et pensel-punkt. Returnerer indekser på NYE tændte lyspunkter
   * (til partikel-effekter) samt om punktet ramte bogstavet.
   */
  addPoint(x: number, y: number): { lit: GlyphSample[]; onGlyph: boolean } {
    const { buckets, bucketSize, cols, samples } = this.map;
    const r = this.brushRadius;
    const r2 = r * r;
    const lit: GlyphSample[] = [];
    let onGlyph = false;

    const bx0 = Math.floor((x - r) / bucketSize);
    const bx1 = Math.floor((x + r) / bucketSize);
    const by0 = Math.floor((y - r) / bucketSize);
    const by1 = Math.floor((y + r) / bucketSize);

    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const arr = buckets.get(by * cols + bx);
        if (!arr) continue;
        for (const i of arr) {
          const s = samples[i];
          const dx = s.x - x;
          const dy = s.y - y;
          if (dx * dx + dy * dy <= r2) {
            onGlyph = true;
            if (!this.covered.has(i)) {
              this.covered.add(i);
              lit.push(s);
            }
          }
        }
      }
    }

    if (onGlyph) this.insideMoves++;
    else this.outsideMoves++;
    return { lit, onGlyph };
  }

  /** 0–1: hvor stor en del af bogstavet der er tændt */
  get coverage(): number {
    return this.map.samples.length === 0
      ? 0
      : this.covered.size / this.map.samples.length;
  }

  /** 0–1: hvor stor en del af stregerne der ramte VED SIDEN AF bogstavet */
  get offRatio(): number {
    const total = this.insideMoves + this.outsideMoves;
    return total === 0 ? 0 : this.outsideMoves / total;
  }

  reset(): void {
    this.covered.clear();
    this.insideMoves = 0;
    this.outsideMoves = 0;
  }
}

/**
 * Udled pensel-radius af glyffens stregbredde via en chamfer distance
 * transform: for hver glyf-pixel beregnes afstanden til nærmeste kant; den
 * største afstand = halvdelen af den tykkeste stregbredde. Penslen sættes til
 * den værdi, så barnet kan tegne bogstavet i ÉN streg langs midterlinjen og
 * fylde bredden ud — i stedet for at skulle "male" en bred flade frem/tilbage.
 *
 * Rasteriseringen skal ske ved SAMME baseScale som buildGlyphMap/silhuetten.
 * Returnerer en radius i canvas-px (afrundet, med lille margen så kanterne nås).
 */
export function deriveBrushRadius(
  glyph: string,
  width: number,
  height: number,
  fontFamily: string,
  baseScale: number,
): number {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 12;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = fitGlyphFontSize(
    ctx,
    glyph,
    width,
    height,
    fontFamily,
    baseScale,
  );
  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillText(glyph, width / 2, height / 2);

  const alpha = ctx.getImageData(0, 0, width, height).data;
  const INF = 1e9;
  const dist = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    dist[i] = alpha[i * 4 + 3] > 96 ? INF : 0;
  }
  // Forward pass
  for (let y = 1; y < height; y++) {
    for (let x = 1; x < width - 1; x++) {
      const k = y * width + x;
      if (dist[k] === 0) continue;
      let m = dist[k];
      if (dist[k - 1] + 1 < m) m = dist[k - 1] + 1;
      if (dist[k - width] + 1 < m) m = dist[k - width] + 1;
      if (dist[k - width - 1] + 1.414 < m) m = dist[k - width - 1] + 1.414;
      if (dist[k - width + 1] + 1.414 < m) m = dist[k - width + 1] + 1.414;
      dist[k] = m;
    }
  }
  // Backward pass — track max
  let maxD = 0;
  for (let y = height - 2; y >= 1; y--) {
    for (let x = width - 2; x >= 1; x--) {
      const k = y * width + x;
      if (dist[k] === 0) continue;
      let m = dist[k];
      if (dist[k + 1] + 1 < m) m = dist[k + 1] + 1;
      if (dist[k + width] + 1 < m) m = dist[k + width] + 1;
      if (dist[k + width + 1] + 1.414 < m) m = dist[k + width + 1] + 1.414;
      if (dist[k + width - 1] + 1.414 < m) m = dist[k + width - 1] + 1.414;
      dist[k] = m;
      if (m < INF && m > maxD) maxD = m;
    }
  }

  // maxD = halv max stregbredde. Lille margen (5 %) så yderkanterne nås.
  return Math.max(6, Math.round(maxD * 1.05));
}

/**
 * Pr. aldersskind:
 *  - `fontScale`: bogstavets størrelse (større = mindre alder).
 *  - `completion`: dæknings-krav for at bogstavet er HELT udfyldt (0.96 i alle
 *    skind — ejer-beslutning: bogstavet skal fyldes helt før man går videre,
 *    i alle aldre; 96 % frem for 100 % fordi de yderste kant-pixels i praksis
 *    ikke kan rammes af en rund pensel på et sample-gitter).
 *  - `maxOffRatio`: bruges KUN til "ren streg"/XP-bonus (isCleanTrace),
 *    aldrig til at afgøre om bogstavet er færdigt.
 *
 * Penslen udledes nu af stregbredden (deriveBrushRadius) og er derfor ikke
 * længere en fast værdi her. Feltet `brushRadius` bevares som sikker fallback
 * hvis stregbredde-udregningen skulle fejle.
 */
export const SKIN_TUNING = {
  soft: { fontScale: 0.82, completion: 0.96, brushRadius: 18, maxOffRatio: 1 },
  mid: { fontScale: 0.7, completion: 0.96, brushRadius: 12, maxOffRatio: 0.35 },
  teen: {
    fontScale: 0.58,
    completion: 0.96,
    brushRadius: 8,
    maxOffRatio: 0.22,
  },
} as const;

/** "Ren" streg (til XP-bonus): høj dækning og lav uden-for-andel. Påvirker
 * KUN rosen/XP-bonussen — fuldføring af selve bogstavet kræver aldrig dette. */
export function isCleanTrace(
  coverage: number,
  offRatio: number,
  skin: keyof typeof SKIN_TUNING,
): boolean {
  const t = SKIN_TUNING[skin];
  return coverage >= t.completion && offRatio <= t.maxOffRatio * 0.6;
}
