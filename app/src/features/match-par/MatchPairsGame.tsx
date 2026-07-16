/**
 * Match-par — tredje kernespil (ordforråds-motoren: dansk ↔ arabisk).
 * Bogstavernes Dal, AI-tilladt verden. Rører aldrig content/aqidah.
 *
 * Signatur: "lysbroer". Brættet er dalen ved nattetide; hvert par er to
 * lanterner. Et rigtigt match tænder en bue af lys mellem kortene med
 * gnist-partikler, lanternerne svæver tændte, og hele dalen bliver
 * gradvist varmere — platformens kernemetafor (lys der vokser) SOM
 * spilmekanik, ligesom lys-malingen i Tegn Bogstavet.
 *
 * Ét spil, tre aldersskind (ændrer HVORDAN, aldrig HVAD):
 *   soft (3–6):  3 par, alle kort synlige, emoji/billede + lyd bærer
 *                betydningen, forkert par vipper blot — altid succes.
 *   mid (7–10):  6 par vend-og-find, transskription, XP + combo + streak.
 *   teen (11–14): 8 par, ren arabisk skrift, træk + præcision, stram look.
 *
 * Effekter: canvas-lysbroer/partikler slås helt fra ved
 * prefers-reduced-motion (CSS-animationer nulstilles globalt i index.css).
 * Lysgnisten i hjørnet er ren fantasi af lys — pr. kerneviden 2 aldrig
 * noget der kan forveksles med afbildning af de hellige.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArrowRight, Flame, RotateCcw, Star } from "lucide-react";
import type { AgeSkin, LessonStepParams, VocabularyWord } from "@/lib/types";
import { type PairCard } from "./engine";
import { useMatchPairs } from "./useMatchPairs";
import "./match-par.css";

export interface MatchPairsGameProps {
  skin: AgeSkin;
  /** Barnets sprogniveau (1–4), fra profilen */
  level?: number;
  /** Transskription under arabiske ord — følger profilens indstilling */
  showTransliteration?: boolean;
  /** Tving en bestemt kategori (fx fra lektions-navigationen) */
  category?: VocabularyWord["category"];
  /** Gives disse to, gemmes XP/streak i progress; ellers spilles uden gem */
  profileId?: string;
  lessonId?: string;
  /** Tilbage til verdenskortet */
  onExit?: () => void;
  /** Trin-tilstand (lektions-rammen ejer progress og navigation) */
  step?: LessonStepParams;
  onRoundComplete?: (earnedXp: number) => void;
}

// ----------------------------------------------------------------------------
// Canvas-effekter (lysbroer + gnister) — ren visuel FX, ingen spillogik
// ----------------------------------------------------------------------------

interface Beam {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  t: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MatchPairsGame({
  skin,
  level = 1,
  showTransliteration = true,
  category,
  profileId,
  lessonId,
  onExit,
  step,
  onRoundComplete,
}: MatchPairsGameProps) {
  const game = useMatchPairs({
    skin,
    level,
    category,
    profileId,
    lessonId,
    step,
    onRoundComplete,
  });
  const reducedMotion = useMemo(prefersReducedMotion, []);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const orbRef = useRef<HTMLDivElement | null>(null);
  const beamsRef = useRef<Beam[]>([]);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef<number | null>(null);
  const handledSeqRef = useRef(0);

  // Stjernehimmel — genereres én gang pr. montering
  const stars = useMemo(
    () =>
      Array.from({ length: 34 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 38}%`,
        size: Math.random() * 2 + 1,
        opacity: (Math.random() * 0.6 + 0.2).toFixed(2),
        delay: `${(Math.random() * 4).toFixed(1)}s`,
      })),
    [],
  );

  // ------------------------------------------------------------------------
  // FX-loop
  // ------------------------------------------------------------------------

  const resizeCanvas = useCallback(() => {
    const board = boardRef.current;
    const canvas = canvasRef.current;
    if (!board || !canvas) return;
    const rect = board.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas, game.deck]);

  const tick = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      rafRef.current = null;
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";

    const beams = beamsRef.current;
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t += 0.028;
      const prog = Math.min(b.t / 0.5, 1);
      const fade = b.t > 0.9 ? Math.max(0, 1 - (b.t - 0.9) / 0.55) : 1;
      if (fade <= 0) {
        beams.splice(i, 1);
        continue;
      }
      // Kvadratisk bue der løfter sig mellem de to lanterner
      const mx = (b.p1.x + b.p2.x) / 2;
      const my = Math.min(b.p1.y, b.p2.y) - 42;
      ctx.strokeStyle = `rgba(255, 214, 120, ${(0.9 * fade).toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(255, 200, 90, 0.9)";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(b.p1.x, b.p1.y);
      const steps = 24;
      const upto = Math.floor(steps * prog);
      for (let s = 1; s <= upto; s++) {
        const t = s / steps;
        const x = (1 - t) * (1 - t) * b.p1.x + 2 * (1 - t) * t * mx + t * t * b.p2.x;
        const y = (1 - t) * (1 - t) * b.p1.y + 2 * (1 - t) * t * my + t * t * b.p2.y;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    const sparks = sparksRef.current;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life -= 0.02;
      if (p.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 220, 140, ${p.life.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.1, p.size * p.life), 0, 7);
      ctx.fill();
    }

    if (beams.length || sparks.length) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const kickFx = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const centerOf = useCallback((key: string) => {
    const board = boardRef.current;
    const el = cardRefs.current.get(key);
    if (!board || !el) return null;
    const br = board.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
  }, []);

  const flashClass = useCallback((keys: readonly string[], cls: string) => {
    for (const key of keys) {
      const el = cardRefs.current.get(key);
      if (!el) continue;
      el.classList.remove(cls);
      void el.offsetWidth; // gen-trig animationen
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 420);
    }
  }, []);

  // Reager på spilbegivenheder (lysbro / vip / ryst)
  useEffect(() => {
    const e = game.event;
    if (!e || e.seq === handledSeqRef.current) return;
    handledSeqRef.current = e.seq;

    if (e.type === "match") {
      const orb = orbRef.current;
      if (orb) {
        orb.classList.remove("mp-cheer");
        void orb.offsetWidth;
        orb.classList.add("mp-cheer");
      }
      if (reducedMotion) return;
      const p1 = centerOf(e.keys[0]);
      const p2 = centerOf(e.keys[1]);
      if (!p1 || !p2) return;
      beamsRef.current.push({ p1, p2, t: 0 });
      for (let i = 0; i < 24; i++) {
        const t = Math.random();
        sparksRef.current.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t - Math.sin(t * Math.PI) * 30,
          vx: (Math.random() - 0.5) * 1.6,
          vy: -Math.random() * 1.4 - 0.3,
          life: 1,
          size: 1.5 + Math.random() * 2.5,
        });
      }
      kickFx();
    } else {
      // Forkert par: soft vipper blidt, mid/teen ryster kort
      flashClass(e.keys, skin === "soft" ? "mp-wob" : "mp-shake");
    }
  }, [game.event, reducedMotion, centerOf, flashClass, kickFx, skin]);

  // Fejring: gnist-udbrud når runden er færdig
  useEffect(() => {
    if (game.phase !== "done" || reducedMotion) return;
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    for (let i = 0; i < 90; i++) {
      sparksRef.current.push({
        x: rect.width / 2,
        y: rect.height / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.75) * 6,
        life: 1 + Math.random(),
        size: 2 + Math.random() * 3,
      });
    }
    kickFx();
  }, [game.phase, reducedMotion, kickFx]);

  // Stop al lyd når spilleren forlader spillet
  useEffect(() => game.stopAllAudio, [game.stopAllAudio]);

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------

  const lightRatio = game.totalPairs > 0 ? game.matched / game.totalPairs : 0;
  const precision =
    game.attempts > 0 ? Math.round((game.matched / game.attempts) * 100) : 100;

  return (
    <div
      data-age-skin={skin}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-(--radius-skin) p-4 sm:p-5"
      style={{ background: "#0b1526", isolation: "isolate" }}
    >
      {/* Varmt lys der vokser med fremskridt */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{ background: "#3a2a12", opacity: lightRatio * 0.55 }}
      />
      {/* Stjernehimmel */}
      {stars.map((s, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="mp-star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            ["--mp-star-opacity" as string]: s.opacity,
          }}
        />
      ))}

      <div className="relative">
        {/* Titel + HUD */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2
            className="me-auto text-lg font-bold"
            style={{ color: "#f4ecd8", fontFamily: "var(--font-display)" }}
          >
            Match-par{" "}
            <span dir="rtl" lang="ar" className="arabic text-base" style={{ color: "#e8c877" }}>
              مُطَابَقَة
            </span>
          </h2>
          {onExit && (
            <button
              onClick={onExit}
              className="rounded-full px-3 py-1 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.1)", color: "#dbe4f2" }}
            >
              Tilbage
            </button>
          )}
        </div>

        <div className="mb-3 flex items-center gap-3 text-xs sm:text-sm" style={{ color: "#b9c6da" }}>
          <span className="shrink-0 font-semibold" style={{ color: "#ffe3a1" }}>
            Lys i dalen
          </span>
          <div
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
            role="progressbar"
            aria-valuenow={Math.round(lightRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Lys i dalen"
          >
            <i className="mp-meter-fill" style={{ width: `${lightRatio * 100}%` }} />
          </div>
          <Hud skin={skin} game={game} precision={precision} />
        </div>

        {/* Indhold */}
        {game.loadState.status === "loading" && (
          <p className="py-16 text-center" style={{ color: "#b9c6da" }}>
            Tænder lanterner …
          </p>
        )}

        {game.loadState.status === "error" && (
          <div className="py-16 text-center">
            <p className="font-semibold" style={{ color: "#f09595" }}>
              Noget gik galt
            </p>
            <p className="mt-1 text-sm" style={{ color: "#b9c6da" }}>
              {game.loadState.message}
            </p>
          </div>
        )}

        {game.loadState.status === "ready" && (
          <>
            <div className="relative" ref={boardRef}>
              <div
                className={`grid gap-2.5 ${game.cfg.flip ? "mp-flip" : ""}`}
                style={{
                  gridTemplateColumns: `repeat(${game.cfg.cols}, minmax(0, 1fr))`,
                }}
              >
                {game.deck.map((card) => (
                  <Card
                    key={card.key}
                    card={card}
                    skin={skin}
                    lit={game.litKeys.has(card.key)}
                    open={game.openKeys.includes(card.key)}
                    selected={game.selectedKey === card.key}
                    showTransliteration={
                      game.cfg.transliteration && showTransliteration
                    }
                    imageUrl={game.imageUrlFor(card.word)}
                    onTap={() => game.tapCard(card)}
                    refFn={(el) => {
                      if (el) cardRefs.current.set(card.key, el);
                      else cardRefs.current.delete(card.key);
                    }}
                  />
                ))}
              </div>
              <canvas
                ref={canvasRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10"
              />

              {/* Fejring */}
              {game.phase === "done" && (
                <RoundDone
                  skin={skin}
                  game={game}
                  precision={precision}
                  savingEnabled={Boolean(profileId && lessonId)}
                  onExit={onExit}
                />
              )}
            </div>

            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={game.restart}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
                style={{ background: "rgba(255,255,255,0.1)", color: "#dbe4f2" }}
              >
                <RotateCcw className="size-4" /> Nyt spil
              </button>
            </div>
          </>
        )}
      </div>

      {/* Lysgnisten — ren fantasi af lys, aldrig en skikkelse */}
      <div ref={orbRef} aria-hidden="true" className="mp-orb absolute bottom-2 end-2.5" />
    </div>
  );
}

// ----------------------------------------------------------------------------
// HUD pr. aldersskind
// ----------------------------------------------------------------------------

type Game = ReturnType<typeof useMatchPairs>;

function Hud({
  skin,
  game,
  precision,
}: {
  skin: AgeSkin;
  game: Game;
  precision: number;
}) {
  const gold = { color: "#ffe3a1" } as const;
  if (skin === "soft") {
    return (
      <span className="shrink-0">
        <b style={gold}>{game.matched}</b> / {game.totalPairs || "…"}
      </span>
    );
  }
  if (skin === "mid") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1">
          <Star className="size-3.5" style={gold} aria-hidden="true" />
          <b style={gold}>{game.xp}</b>
        </span>
        <span className="flex items-center gap-1">
          <Flame className="size-3.5" style={gold} aria-hidden="true" />
          <b style={gold}>{game.combo}</b>
        </span>
      </span>
    );
  }
  return (
    <span className="shrink-0">
      Træk <b style={gold}>{game.moves}</b> · <b style={gold}>{precision}%</b> ·{" "}
      XP <b style={gold}>{game.xp}</b>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Kort
// ----------------------------------------------------------------------------

function Card({
  card,
  skin,
  lit,
  open,
  selected,
  showTransliteration,
  imageUrl,
  onTap,
  refFn,
}: {
  card: PairCard;
  skin: AgeSkin;
  lit: boolean;
  open: boolean;
  selected: boolean;
  showTransliteration: boolean;
  imageUrl: string | null;
  onTap: () => void;
  refFn: (el: HTMLButtonElement | null) => void;
}) {
  const minHeight = skin === "soft" ? "7rem" : skin === "mid" ? "5.75rem" : "5.25rem";

  const label =
    card.side === "ar"
      ? "Arabisk kort"
      : `Dansk kort: ${card.word.word_da}`;

  return (
    <button
      ref={refFn}
      onClick={onTap}
      aria-label={label}
      aria-pressed={selected || open || lit}
      className={`mp-card relative w-full ${lit ? "mp-lit" : ""} ${
        open ? "mp-open" : ""
      } ${selected ? "mp-sel" : ""}`}
      style={{ minHeight }}
    >
      <span className="mp-card-inner">
        <span className="mp-face mp-front">
          {card.side === "da" ? (
            <DanishFace card={card} skin={skin} imageUrl={imageUrl} />
          ) : (
            <ArabicFace
              card={card}
              skin={skin}
              showTransliteration={showTransliteration}
            />
          )}
        </span>
        <span className="mp-face mp-back" aria-hidden="true">
          ✦
        </span>
      </span>
    </button>
  );
}

function DanishFace({
  card,
  skin,
  imageUrl,
}: {
  card: PairCard;
  skin: AgeSkin;
  imageUrl: string | null;
}) {
  if (skin === "soft") {
    // 3–6: billedet/emojien bærer betydningen (ingen læsekrav); det danske
    // ord står lille under som blid læse-eksponering.
    return (
      <>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="size-12 object-contain" />
        ) : card.word.emoji ? (
          <span className="text-4xl leading-none" aria-hidden="true">
            {card.word.emoji}
          </span>
        ) : null}
        <span className="text-base font-semibold">{card.word.word_da}</span>
      </>
    );
  }
  return <span className="text-lg font-semibold">{card.word.word_da}</span>;
}

function ArabicFace({
  card,
  skin,
  showTransliteration,
}: {
  card: PairCard;
  skin: AgeSkin;
  showTransliteration: boolean;
}) {
  return (
    <>
      <span
        dir="rtl"
        lang="ar"
        className="arabic leading-snug"
        style={{ fontSize: skin === "soft" ? "1.9rem" : "1.6rem" }}
      >
        {card.word.word_ar}
      </span>
      {showTransliteration && (
        <span className="text-xs italic" style={{ color: "#8fa4c4" }}>
          {card.word.transliteration}
        </span>
      )}
      {skin === "teen" && (
        <span
          className="rounded-full px-2 text-[11px]"
          style={{
            color: "#8ed0b5",
            border: "1px solid rgba(120, 200, 165, 0.4)",
          }}
        >
          {card.word.register === "fusha" ? "fusha" : "hverdag"}
        </span>
      )}
    </>
  );
}

// ----------------------------------------------------------------------------
// Fejring
// ----------------------------------------------------------------------------

function RoundDone({
  skin,
  game,
  precision,
  savingEnabled,
  onExit,
}: {
  skin: AgeSkin;
  game: Game;
  precision: number;
  savingEnabled: boolean;
  onExit?: () => void;
}) {
  const stats =
    skin === "soft"
      ? `Alle ${game.totalPairs} lanterner er tændt`
      : skin === "mid"
        ? `${game.totalPairs} par · ${game.xp} XP · bedste stime ${game.bestCombo}`
        : `${game.totalPairs} par på ${game.moves} træk · præcision ${precision}% · ${game.xp} XP`;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl text-center"
      style={{ background: "rgba(10, 16, 28, 0.85)" }}
    >
      <div className="px-4">
        <p
          className="text-xl font-bold sm:text-2xl"
          style={{
            color: "#ffe9b8",
            textShadow: "0 0 22px rgba(255, 190, 70, 0.8)",
            fontFamily: "var(--font-display)",
          }}
        >
          Dalen lyser! ✦
        </p>
        <p className="mt-2 text-sm" style={{ color: "#cdd8ea" }}>
          {stats}
        </p>
        {savingEnabled && (
          <p className="mt-1 text-xs" style={{ color: "#8fa4c4" }}>
            {game.saveState === "saving" && "Gemmer fremskridt …"}
            {game.saveState === "saved" && "Fremskridt gemt ✓"}
            {game.saveState === "error" && "Kunne ikke gemme — prøver igen næste runde"}
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={game.restart}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform active:scale-95"
            style={{ background: "var(--color-nour)", color: "#3d2a00" }}
          >
            Spil igen <ArrowRight className="size-4" />
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.12)", color: "#dbe4f2" }}
            >
              Tilbage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
