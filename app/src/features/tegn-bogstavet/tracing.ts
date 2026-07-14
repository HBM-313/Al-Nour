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
 * Rasterisér en glyf og byg dæknings-kortet.
 * Fonten skal være færdigindlæst (await document.fonts.load(...)) inden kald,
 * ellers måles der mod en fallback-font.
 */
export function buildGlyphMap(
  glyph: string,
  width: number,
  height: number,
  fontFamily: string,
): GlyphMap {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return emptyMap();

  // Find den største font-størrelse hvor glyffen passer med luft
  let fontSize = Math.floor(height * 0.72);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (; fontSize > 12; fontSize -= 8) {
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    const m = ctx.measureText(glyph);
    if (m.width <= width * 0.82) break;
  }

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

/** Dæknings-tærskel og pensel-tykkelse pr. aldersskind */
export const SKIN_TUNING = {
  soft: { threshold: 0.6, brushRadius: 26, maxOffRatio: 1 }, // kan ikke fejle
  mid: { threshold: 0.75, brushRadius: 18, maxOffRatio: 0.5 },
  teen: { threshold: 0.82, brushRadius: 14, maxOffRatio: 0.35 },
} as const;

/** "Ren" streg (til XP-bonus): høj dækning og lav uden-for-andel */
export function isCleanTrace(
  coverage: number,
  offRatio: number,
  skin: keyof typeof SKIN_TUNING,
): boolean {
  const t = SKIN_TUNING[skin];
  return coverage >= t.threshold && offRatio <= t.maxOffRatio * 0.6;
}
