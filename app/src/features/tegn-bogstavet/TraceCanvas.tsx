/**
 * TraceCanvas — lærredet hvor barnet maler LYS ind i bogstavet.
 *
 * Signatur-idéen (platformens kernemetafor som spilmekanik): bogstavet
 * starter som en dæmpet silhuet på nattehimmel-baggrund; barnets finger
 * fylder det med gyldent nour-lys. Nye tændte lyspunkter afgiver små
 * opad-drivende gnister. Ved fuld dækning "tænder" bogstavet i et udbrud.
 *
 * Tre lag i ét canvas pr. frame:
 *   1. glyf-silhuet (dæmpet night-soft)
 *   2. barnets lys-streger (klippet til glyffen via offscreen paint-lag,
 *      så lyset kun kan bo INDE i bogstavet — man maler bogstavet, ikke
 *      skærmen)
 *   3. gnist-partikler + start-hint-puls
 *
 * Respekterer prefers-reduced-motion (færre/ingen partikler, ingen puls).
 */

import { useCallback, useEffect, useRef } from "react";
import {
  buildGlyphMap,
  deriveBrushRadius,
  fitGlyphFontSize,
  TraceProgress,
  type GlyphMap,
  type GlyphSample,
} from "./tracing";

const ARABIC_FONT = '"Noto Naskh Arabic", "Amiri", serif';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
  size: number;
}

export interface TraceCanvasProps {
  glyph: string;
  /** Fallback pensel-radius; den faktiske pensel udledes af stregbredden. */
  brushRadius: number;
  /** Aldersskindets fontScale (styrer bogstavets størrelse). */
  baseScale: number;
  /** Kaldes løbende med (coverage 0–1, offRatio 0–1) */
  onProgress: (coverage: number, offRatio: number) => void;
  /** Kaldes én gang når dækningen når tærsklen (fuld udfyldning) */
  onComplete: () => void;
  threshold: number;
  /** Lås canvas efter færdiggørelse */
  locked: boolean;
  className?: string;
}

export function TraceCanvas({
  glyph,
  brushRadius,
  baseScale,
  onProgress,
  onComplete,
  threshold,
  locked,
  className = "",
}: TraceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Faktisk pensel-radius udledt af glyffens stregbredde (sat ved glyf-opsætning)
  const brushRef = useRef<number>(brushRadius);
  const stateRef = useRef<{
    map: GlyphMap | null;
    progress: TraceProgress | null;
    paint: HTMLCanvasElement | null; // offscreen: barnets rå streger
    layer: HTMLCanvasElement | null; // offscreen: glyf + klippet lys, sammensat her FØR den lægges på hovedcanvas
    particles: Particle[];
    drawing: boolean;
    last: { x: number; y: number } | null;
    completed: boolean;
    burst: number; // 1 → 0 efter færdig-tænding
    raf: number;
    reducedMotion: boolean;
    hintPhase: number;
  }>({
    map: null,
    progress: null,
    paint: null,
    layer: null,
    particles: [],
    drawing: false,
    last: null,
    completed: false,
    burst: 0,
    raf: 0,
    reducedMotion:
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    hintPhase: 0,
  });

  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // --------------------------------------------------------------------------
  // Opsætning pr. glyf: rasterisér når fonten er klar
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const st = stateRef.current;
    let cancelled = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    st.map = null;
    st.progress = null;
    st.completed = false;
    st.burst = 0;
    st.particles = [];
    st.last = null;

    const paint = document.createElement("canvas");
    paint.width = w;
    paint.height = h;
    st.paint = paint;

    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    st.layer = layer;

    // Vent på at den arabiske font faktisk er indlæst — ellers rasteriserer
    // vi en fallback-serif og dæknings-kortet passer ikke til det viste.
    void document.fonts.load(`600 80px ${ARABIC_FONT}`, glyph).then(() => {
      if (cancelled) return;
      // Pensel = glyffens stregbredde, så én streg langs midten fylder ud.
      const derived = deriveBrushRadius(glyph, w, h, ARABIC_FONT, baseScale);
      brushRef.current = derived;
      st.map = buildGlyphMap(glyph, w, h, ARABIC_FONT, baseScale);
      st.progress = new TraceProgress(st.map, derived);
      onProgressRef.current(0, 0);
    });

    // ------------------------------------------------------------------------
    // Render-løkke
    // ------------------------------------------------------------------------
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function frame() {
      if (cancelled || !ctx) return;
      const map = st.map;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Baggrund: nattehimmel med svag vignet — "før lyset"
      const bg = ctx.createRadialGradient(
        w / 2,
        h / 2,
        h * 0.1,
        w / 2,
        h / 2,
        h * 0.75,
      );
      bg.addColorStop(0, "#26355f");
      bg.addColorStop(1, "#1d2b50");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      if (map && st.layer) {
        const lctx = st.layer.getContext("2d");
        if (lctx) {
          lctx.setTransform(1, 0, 0, 1, 0, 0);
          lctx.clearRect(0, 0, w, h);

          // 1) Dæmpet silhuet: bogstavet "sover" — tegnet på det TOMME lag,
          // så source-atop herunder klipper mod glyffen alene, ikke mod
          // hele canvas'et (som var buggen: klip skete tidligere direkte på
          // hoved-canvas'et efter baggrunden allerede var fyldt).
          lctx.font = glyphFont(lctx, glyph, w, h, baseScale);
          lctx.textAlign = "center";
          lctx.textBaseline = "middle";
          lctx.fillStyle = "rgba(120, 136, 190, 0.32)";
          lctx.fillText(glyph, w / 2, h / 2);

          // 2) Barnets lys — klippet til glyffen på DETTE lag
          if (st.paint) {
            lctx.globalCompositeOperation = "source-atop";
            lctx.globalAlpha = 0.55;
            lctx.filter = "blur(6px)";
            lctx.drawImage(st.paint, 0, 0);
            lctx.filter = "none";
            lctx.globalAlpha = 1;
            lctx.drawImage(st.paint, 0, 0);
          }

          // Færdig-tænding: hele bogstavet blusser op
          if (st.burst > 0) {
            lctx.globalCompositeOperation = "source-over";
            lctx.shadowColor = "#ffd98a";
            lctx.shadowBlur = 40 * st.burst;
            lctx.fillStyle = `rgba(255, 217, 138, ${0.35 * st.burst})`;
            lctx.fillText(glyph, w / 2, h / 2);
            lctx.shadowBlur = 0;
            st.burst = Math.max(0, st.burst - 0.02);
          }
          lctx.globalCompositeOperation = "source-over";
        }

        ctx.drawImage(st.layer, 0, 0, w, h);

        // 3) Start-hint: pulserende lysprik hvor barnet bør begynde (RTL)
        if (
          map.startHint &&
          !st.completed &&
          (st.progress?.coverage ?? 0) < 0.02 &&
          !st.reducedMotion
        ) {
          st.hintPhase += 0.06;
          const pulse = 0.5 + 0.5 * Math.sin(st.hintPhase);
          ctx.beginPath();
          ctx.arc(
            map.startHint.x,
            map.startHint.y,
            8 + 6 * pulse,
            0,
            Math.PI * 2,
          );
          ctx.fillStyle = `rgba(240, 180, 41, ${0.35 + 0.4 * pulse})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(map.startHint.x, map.startHint.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffd98a";
          ctx.fill();
        }
      }

      // Gnist-partikler (opad-drivende lys)
      for (let i = st.particles.length - 1; i >= 0; i--) {
        const p = st.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.03;
        p.life -= 0.02;
        if (p.life <= 0) {
          st.particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 217, 138, ${0.8 * p.life})`;
        ctx.fill();
      }

      st.raf = requestAnimationFrame(frame);
    }
    st.raf = requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(st.raf);
    };
  }, [glyph, brushRadius, baseScale]);

  // --------------------------------------------------------------------------
  // Pointer-håndtering: mal på paint-laget, tænd lyspunkter, afgiv gnister
  // --------------------------------------------------------------------------
  const paintStroke = useCallback(
    (x: number, y: number) => {
      const st = stateRef.current;
      if (!st.paint || !st.progress || st.completed || lockedRef.current)
        return;

      const pctx = st.paint.getContext("2d");
      if (!pctx) return;

      // Streg med rund pensel — bredde = glyffens stregbredde (én-streg-fyld)
      const r = brushRef.current;
      pctx.strokeStyle = "#f0b429";
      pctx.fillStyle = "#f0b429";
      pctx.lineWidth = r * 2;
      pctx.lineCap = "round";
      pctx.lineJoin = "round";
      if (st.last) {
        pctx.beginPath();
        pctx.moveTo(st.last.x, st.last.y);
        pctx.lineTo(x, y);
        pctx.stroke();
      } else {
        pctx.beginPath();
        pctx.arc(x, y, r, 0, Math.PI * 2);
        pctx.fill();
      }
      st.last = { x, y };

      const { lit } = st.progress.addPoint(x, y);

      // Gnister fra nyligt tændte punkter (dæmpet ved reduced motion)
      if (!st.reducedMotion) {
        const maxNew = Math.min(lit.length, 3);
        for (let i = 0; i < maxNew; i++) {
          const s = lit[(Math.random() * lit.length) | 0] as GlyphSample;
          st.particles.push({
            x: s.x,
            y: s.y,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.6 - Math.random() * 0.8,
            life: 1,
            size: 2 + Math.random() * 2.5,
          });
        }
        if (st.particles.length > 120) st.particles.splice(0, 20);
      }

      const cov = st.progress.coverage;
      onProgressRef.current(cov, st.progress.offRatio);

      if (cov >= threshold && !st.completed) {
        st.completed = true;
        st.burst = 1;
        if (!st.reducedMotion) {
          // Jubel-udbrud: gnister fra hele bogstavet
          const map = st.map;
          if (map) {
            for (let i = 0; i < 40; i++) {
              const s =
                map.samples[(Math.random() * map.samples.length) | 0];
              st.particles.push({
                x: s.x,
                y: s.y,
                vx: (Math.random() - 0.5) * 2.4,
                vy: -1 - Math.random() * 2,
                life: 1,
                size: 2.5 + Math.random() * 3,
              });
            }
          }
        }
        onCompleteRef.current();
      }
    },
    [threshold],
  );

  const pointerPos = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <canvas
      ref={canvasRef}
      className={`w-full touch-none select-none ${className}`}
      style={{ aspectRatio: "1 / 1" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        stateRef.current.drawing = true;
        stateRef.current.last = null;
        const { x, y } = pointerPos(e);
        paintStroke(x, y);
      }}
      onPointerMove={(e) => {
        if (!stateRef.current.drawing) return;
        const { x, y } = pointerPos(e);
        paintStroke(x, y);
      }}
      onPointerUp={() => {
        stateRef.current.drawing = false;
        stateRef.current.last = null;
      }}
      onPointerCancel={() => {
        stateRef.current.drawing = false;
        stateRef.current.last = null;
      }}
    />
  );
}

/** Samme font-tilpasning som i tracing.ts — skal matche 1:1 (samme baseScale) */
function glyphFont(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  w: number,
  h: number,
  baseScale: number,
): string {
  const fontSize = fitGlyphFontSize(ctx, glyph, w, h, ARABIC_FONT, baseScale);
  return `600 ${fontSize}px ${ARABIC_FONT}`;
}
