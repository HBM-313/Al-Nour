import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SKIN_TUNING,
  TraceProgress,
  buildGlyphMap,
  deriveBrushRadius,
  fitGlyphFontSize,
  isCleanTrace,
  type GlyphMap,
} from "./tracing";

// ----------------------------------------------------------------------------
// isCleanTrace
// ----------------------------------------------------------------------------

describe("isCleanTrace", () => {
  it("er sand ved høj dækning og lav uden-for-andel (alle skind)", () => {
    for (const skin of ["soft", "mid", "teen"] as const) {
      expect(isCleanTrace(1, 0, skin)).toBe(true);
    }
  });

  it("er falsk hvis dækningen er under skindets completion-krav", () => {
    const t = SKIN_TUNING.mid;
    expect(isCleanTrace(t.completion - 0.1, 0, "mid")).toBe(false);
  });

  it("er falsk hvis for mange streger gik ved siden af, selv med fuld dækning", () => {
    // teen: maxOffRatio=0.22 → grænsen for "ren" er 0.22*0.6=0.132
    expect(isCleanTrace(1, 0.2, "teen")).toBe(false);
    expect(isCleanTrace(1, 0.1, "teen")).toBe(true);
  });

  it("bruger samme completion-tal som SKIN_TUNING (ingen divergerende konstant)", () => {
    for (const skin of ["soft", "mid", "teen"] as const) {
      const t = SKIN_TUNING[skin];
      expect(isCleanTrace(t.completion, 0, skin)).toBe(true);
      expect(isCleanTrace(t.completion - 0.01, 0, skin)).toBe(false);
    }
  });
});

// ----------------------------------------------------------------------------
// TraceProgress — håndbygget GlyphMap (ingen canvas nødvendig: TraceProgress
// arbejder udelukkende på GlyphMap-DATA, ikke på selve rasteriseringen).
// ----------------------------------------------------------------------------

/**
 * Lille, håndkontrolleret GlyphMap: tre punkter langs x-aksen med 10px
 * mellemrum, bucketSize=10 (bevidst forskelligt fra produktionens BUCKET_SIZE
 * for at bevise at TraceProgress ikke er hardcodet til den værdi, men
 * udelukkende bruger felterne på selve kortet).
 */
function makeTestMap(): GlyphMap {
  const samples = [
    { x: 0, y: 0 }, // idx 0
    { x: 10, y: 0 }, // idx 1
    { x: 20, y: 0 }, // idx 2
  ];
  const bucketSize = 10;
  const cols = 3;
  const buckets = new Map<number, number[]>();
  samples.forEach((s, i) => {
    const key = Math.floor(s.y / bucketSize) * cols + Math.floor(s.x / bucketSize);
    const arr = buckets.get(key);
    if (arr) arr.push(i);
    else buckets.set(key, [i]);
  });
  return {
    samples,
    buckets,
    bucketSize,
    cols,
    startHint: samples[2],
    bounds: { x: 0, y: 0, w: 20, h: 0 },
  };
}

describe("TraceProgress", () => {
  it("starter med 0 dækning og 0 offRatio", () => {
    const tp = new TraceProgress(makeTestMap(), 5);
    expect(tp.coverage).toBe(0);
    expect(tp.offRatio).toBe(0);
  });

  it("tænder et punkt direkte på det og øger dækningen", () => {
    const tp = new TraceProgress(makeTestMap(), 5);
    const { lit, onGlyph } = tp.addPoint(0, 0);
    expect(onGlyph).toBe(true);
    expect(lit).toHaveLength(1);
    expect(lit[0]).toEqual({ x: 0, y: 0 });
    expect(tp.coverage).toBeCloseTo(1 / 3);
  });

  it("tænder IKKE samme punkt to gange (idempotent dækning)", () => {
    const tp = new TraceProgress(makeTestMap(), 5);
    tp.addPoint(0, 0);
    const second = tp.addPoint(0, 0);
    expect(second.lit).toHaveLength(0); // ingen NYE punkter
    expect(second.onGlyph).toBe(true); // men stadig "på bogstavet"
    expect(tp.coverage).toBeCloseTo(1 / 3); // uændret, ikke dobbelt-talt
  });

  it("punkter uden for penslens radius rammer intet og tæller som 'ved siden af'", () => {
    const tp = new TraceProgress(makeTestMap(), 5);
    const { lit, onGlyph } = tp.addPoint(1000, 1000);
    expect(lit).toHaveLength(0);
    expect(onGlyph).toBe(false);
    expect(tp.coverage).toBe(0);
    expect(tp.offRatio).toBe(1); // 1 af 1 bevægelser var udenfor
  });

  it("offRatio afspejler forholdet mellem ramt/ikke-ramt over flere punkter", () => {
    const tp = new TraceProgress(makeTestMap(), 5);
    tp.addPoint(0, 0); // inde
    tp.addPoint(10, 0); // inde
    tp.addPoint(1000, 1000); // ude
    tp.addPoint(1000, 2000); // ude
    expect(tp.offRatio).toBeCloseTo(0.5);
  });

  it("REGRESSION: søger på tværs af nabo-buckets, ikke kun punktets egen bucket", () => {
    // x=9 med radius=5 ligger i bucket 0 (floor(9/10)=0), men søgeranden
    // (x-r..x+r = 4..14) rammer OGSÅ bucket 1 (hvor sample idx1 @ x=10 bor).
    // Afstanden fra 9 til 10 er 1 (inden for radius 5) — punktet SKAL tændes.
    // En fejlagtig implementation der kun tjekker afsenderens egen bucket
    // ville aldrig finde idx1 her, og denne test ville fejle.
    const tp = new TraceProgress(makeTestMap(), 5);
    const { lit } = tp.addPoint(9, 0);
    expect(lit).toHaveLength(1);
    expect(lit[0]).toEqual({ x: 10, y: 0 });
  });

  it("tænder flere punkter inden for radius i samme kald", () => {
    // Radius 15 fra x=10 rammer alle tre punkter (afstand 10, 0, 10).
    const tp = new TraceProgress(makeTestMap(), 15);
    const { lit } = tp.addPoint(10, 0);
    expect(lit).toHaveLength(3);
    expect(tp.coverage).toBe(1);
  });

  it("reset() nulstiller dækning og offRatio helt", () => {
    const tp = new TraceProgress(makeTestMap(), 5);
    tp.addPoint(0, 0);
    tp.addPoint(1000, 1000);
    tp.reset();
    expect(tp.coverage).toBe(0);
    expect(tp.offRatio).toBe(0);
    // Efter reset kan de samme punkter tændes igen (ikke stadig "covered")
    const { lit } = tp.addPoint(0, 0);
    expect(lit).toHaveLength(1);
  });

  it("coverage er 0 for et tomt GlyphMap (undgår division med 0 → NaN)", () => {
    const emptyMap: GlyphMap = {
      samples: [],
      buckets: new Map(),
      bucketSize: 10,
      cols: 0,
      startHint: null,
      bounds: { x: 0, y: 0, w: 0, h: 0 },
    };
    const tp = new TraceProgress(emptyMap, 5);
    expect(tp.coverage).toBe(0);
    expect(Number.isNaN(tp.coverage)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// buildGlyphMap / fitGlyphFontSize / deriveBrushRadius — kræver et mocket
// canvas 2D-context, da jsdom ikke rasteriserer rigtige fonte. Mock'et
// tegner en KENDT, kontrolleret figur i stedet for en rigtig glyf, så vi
// tester algoritmen (sampling, støj-filter, buckets, start-hint) — ikke
// font-rendering, som hverken er deterministisk eller relevant her.
// ----------------------------------------------------------------------------

interface FakeCtx2D {
  font: string;
  textAlign: string;
  textBaseline: string;
  fillStyle: string;
  measureText: (text: string) => { width: number };
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  getImageData: (
    x: number,
    y: number,
    w: number,
    h: number,
  ) => { data: Uint8ClampedArray };
}

/**
 * Bygger et fake 2D-canvas-context. `draw` kaldes ved fillText() og skal
 * selv sætte alpha-værdier i bufferen (positions-/tekst-parametrene fra selve
 * kaldet ignoreres bevidst — vi styrer figuren direkte fra testen).
 */
function makeFakeCtx(
  width: number,
  height: number,
  draw: (buffer: Uint8ClampedArray) => void,
  measuredWidth = 1,
): FakeCtx2D {
  const buffer = new Uint8ClampedArray(width * height * 4);
  return {
    font: "",
    textAlign: "",
    textBaseline: "",
    fillStyle: "",
    measureText: () => ({ width: measuredWidth }),
    clearRect: () => buffer.fill(0),
    fillText: () => draw(buffer),
    getImageData: () => ({ data: buffer }),
  };
}

/** Sætter alpha=255 for et rektangel (inklusiv kant), i en width×height-buffer. */
function fillRect(
  buffer: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      buffer[(y * width + x) * 4 + 3] = 255;
    }
  }
}

/** Sætter alpha=255 for ét enkelt pixel. */
function fillPixel(buffer: Uint8ClampedArray, width: number, x: number, y: number) {
  buffer[(y * width + x) * 4 + 3] = 255;
}

/** Installerer document.createElement("canvas") → fake context for testens varighed. */
function mockCanvas(ctx: FakeCtx2D) {
  const real = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "canvas") {
      return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
    }
    return real(tag);
  }) as typeof document.createElement);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildGlyphMap", () => {
  it("sampler kun inden for det fyldte område og fjerner isoleret støj (glyf-klipning)", () => {
    const width = 90;
    const height = 90;
    const ctx = makeFakeCtx(width, height, (buffer) => {
      // Solid blok: x∈[6,42], y∈[6,42] — mange nabo-punkter, overlever
      // isCore-filtret.
      fillRect(buffer, width, 6, 6, 42, 42);
      // Isoleret enkelt-pixel langt fra blokken, uden naboer inden for
      // støj-filtrets radius → skal EKSKLUDERES af buildGlyphMap.
      fillPixel(buffer, width, 81, 81);
    });
    mockCanvas(ctx);

    const map = buildGlyphMap("ط", width, height, "Test Font", 0.72);

    // Grid-punkter i [6,42] med SAMPLE_STEP=6, start ved 3: 9,15,21,27,33,39
    // → 6×6 = 36 punkter. Støj-pixlen (81,81) er filtreret fra.
    expect(map.samples).toHaveLength(36);
    expect(map.samples.every((s) => s.x <= 42 && s.y <= 42)).toBe(true);
    expect(map.samples.some((s) => s.x >= 75 || s.y >= 75)).toBe(false);

    // Bemærk: bounds beregnes af de RÅ alpha-samples (inkl. støj-pixlen),
    // FØR isCore-filtret kører — kun selve `samples`-listen renses for støj.
    // Det er den faktiske, eksisterende adfærd i buildGlyphMap (bounds og
    // finalSamples deler bevidst ikke samme filtrering); testen dokumenterer
    // det, den ændrer det ikke.
    expect(map.bounds).toEqual({ x: 9, y: 9, w: 72, h: 72 });

    // FUND (dokumenteret, ikke rettet i denne test-only session — flages til
    // ejeren): startHint's "højre fjerdedel" beregnes ud fra de RÅ,
    // ufiltrerede bounds (maxX=81, inkl. støj-pixlen), ikke de rensede
    // finalSamples (maxX=39). Her betyder det at rightEdge (63) bliver
    // højere end noget rigtigt glyf-punkt kan nå (max 39) — startHint bliver
    // null, selvom glyffen tydeligvis HAR et gyldigt højre-fjerdedel-punkt.
    // En isoleret støj-pixel langt fra bogstavet kan altså i praksis slå
    // start-hintet helt fra. Testen dokumenterer den nuværende adfærd.
    expect(map.startHint).toBeNull();

    // Buckets dækker alle (filtrerede) samples, ingen mister eller dubleres.
    let bucketedCount = 0;
    for (const arr of map.buckets.values()) bucketedCount += arr.length;
    expect(bucketedCount).toBe(map.samples.length);
  });

  it("startHint peger på øverste punkt i højre fjerdedel, uden forstyrrende støj", () => {
    const width = 90;
    const height = 90;
    const ctx = makeFakeCtx(width, height, (buffer) => {
      fillRect(buffer, width, 6, 6, 42, 42); // samme rene blok, ingen støj denne gang
    });
    mockCanvas(ctx);

    const map = buildGlyphMap("ط", width, height, "Test Font", 0.72);
    // minX=maxX=9..39 (uden støj er bounds og finalSamples nu enige).
    expect(map.bounds).toEqual({ x: 9, y: 9, w: 30, h: 30 });
    expect(map.startHint).toEqual({ x: 33, y: 9 });
  });

  it("tomt canvas (intet tegnet) giver en tom GlyphMap uden fejl", () => {
    const width = 40;
    const height = 40;
    const ctx = makeFakeCtx(width, height, () => {
      /* tegner intet */
    });
    mockCanvas(ctx);

    const map = buildGlyphMap("ا", width, height, "Test Font", 0.72);
    expect(map.samples).toHaveLength(0);
    expect(map.startHint).toBeNull();
    expect(map.buckets.size).toBe(0);
  });

  it("returnerer en tom map hvis canvas-context ikke kan hentes (fail-soft)", () => {
    const real = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "canvas") {
        return { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
      }
      return real(tag);
    }) as typeof document.createElement);

    const map = buildGlyphMap("ب", 40, 40, "Test Font", 0.72);
    expect(map.samples).toEqual([]);
    expect(map.buckets.size).toBe(0);
  });
});

describe("fitGlyphFontSize", () => {
  it("skrumper fontstørrelsen indtil teksten passer inden for 82% af bredden", () => {
    // measureText-bredde = fontSize * 2 (kontrolleret formel til testen).
    const ctx = makeFakeCtx(100, 100, () => {}, 0);
    ctx.measureText = (_text: string) => {
      // fontSize udledes af ctx.font-strengen sat lige før kaldet.
      const match = /(\d+)px/.exec(ctx.font);
      const fontSize = match ? Number(match[1]) : 0;
      return { width: fontSize * 2 };
    };
    mockCanvas(ctx);

    // baseScale 0.72 × height 100 → initial fontSize = 72.
    // Løkken skal falde til 36 (36*2=72 ≤ 82), da 42*2=84 > 82.
    const size = fitGlyphFontSize(
      ctx as unknown as CanvasRenderingContext2D,
      "ط",
      100,
      100,
      "Test Font",
      0.72,
    );
    expect(size).toBe(36);
  });

  it("stopper aldrig under gulvet på 12px, selv hvis teksten aldrig passer", () => {
    const ctx = makeFakeCtx(100, 100, () => {}, 0);
    ctx.measureText = () => ({ width: 999999 }); // passer ALDRIG
    mockCanvas(ctx);

    const size = fitGlyphFontSize(
      ctx as unknown as CanvasRenderingContext2D,
      "ط",
      100,
      100,
      "Test Font",
      0.72,
    );
    expect(size).toBe(12);
  });
});

describe("deriveBrushRadius", () => {
  it("returnerer minimumsradius 6 for et helt tomt canvas", () => {
    const ctx = makeFakeCtx(40, 40, () => {
      /* intet tegnet */
    });
    mockCanvas(ctx);
    const radius = deriveBrushRadius("ا", 40, 40, "Test Font", 0.72);
    expect(radius).toBe(6);
  });

  it("giver en større radius for en TYKKERE figur end en tyndere (monoton i stregbredde)", () => {
    const width = 80;
    const height = 80;

    const thin = makeFakeCtx(width, height, (buffer) => {
      fillRect(buffer, width, 30, 10, 34, 70); // 5px bred stribe
    });
    mockCanvas(thin);
    const thinRadius = deriveBrushRadius("ا", width, height, "Test Font", 0.72);
    vi.restoreAllMocks();

    const thick = makeFakeCtx(width, height, (buffer) => {
      fillRect(buffer, width, 10, 10, 60, 70); // 50px bred blok
    });
    mockCanvas(thick);
    const thickRadius = deriveBrushRadius("ا", width, height, "Test Font", 0.72);

    expect(thinRadius).toBeGreaterThanOrEqual(6);
    expect(thickRadius).toBeGreaterThan(thinRadius);
  });

  it("respekterer altid mindstegrænsen på 6px, uanset input", () => {
    const ctx = makeFakeCtx(20, 20, (buffer) => fillPixel(buffer, 20, 10, 10));
    mockCanvas(ctx);
    const radius = deriveBrushRadius("ا", 20, 20, "Test Font", 0.72);
    expect(radius).toBeGreaterThanOrEqual(6);
  });
});

describe("SKIN_TUNING", () => {
  it("kræver samme fuldførelses-tærskel (96%) i alle tre aldersskind", () => {
    // Ejer-beslutning: bogstavet skal fyldes helt før man går videre, i ALLE
    // aldre — denne test fanger hvis nogen ved en fejl differentierer den.
    expect(SKIN_TUNING.soft.completion).toBe(0.96);
    expect(SKIN_TUNING.mid.completion).toBe(0.96);
    expect(SKIN_TUNING.teen.completion).toBe(0.96);
  });

  it("penslen bliver mindre og kravene strengere med stigende alder", () => {
    expect(SKIN_TUNING.soft.brushRadius).toBeGreaterThan(SKIN_TUNING.mid.brushRadius);
    expect(SKIN_TUNING.mid.brushRadius).toBeGreaterThan(SKIN_TUNING.teen.brushRadius);
    expect(SKIN_TUNING.soft.maxOffRatio).toBeGreaterThan(SKIN_TUNING.mid.maxOffRatio);
    expect(SKIN_TUNING.mid.maxOffRatio).toBeGreaterThan(SKIN_TUNING.teen.maxOffRatio);
  });
});
