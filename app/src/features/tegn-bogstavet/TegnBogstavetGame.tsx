/**
 * Tegn Bogstavet — andet kernespil (tracing: barnet maler lys ind i bogstavet).
 * Bogstavernes Dal, AI-tilladt verden. Rører aldrig content/aqidah.
 *
 * Ét spil, tre aldersskind:
 *   soft (3–6):  4 bogstaver (fra de første 12), isoleret form, tyk pensel,
 *                lav tærskel — kan ikke fejle. Nouri hepper meget.
 *   mid (7–10):  5 bogstaver, isoleret form, XP for "rene" streger
 *                (høj dækning, lidt uden for), streak, fremskridt gemmes.
 *   teen (11–14): ét bogstav ad gangen i alle FIRE former (alene → start →
 *                midt → slut), tyndere pensel, præcisionsmåler, stram æstetik.
 *
 * Følgesvend: Nouri, en 3D-lysånd (lazy-loadet Three.js) — reagerer på
 * fremskridt: idle → cheer (milepæle) → celebrate (bogstav tændt).
 *
 * Lyd: medie-fil vinder hvis den findes, ellers browser-TTS (lyd-reglen
 * 2026-07-14: TTS overalt, kun Quran-recitation er human — DB-håndhævet).
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, RotateCcw, Volume2, Flame } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { preferredAudioId } from "@/lib/voicePref";
import { createAudioPlayer, speak } from "@/lib/audio";
import { saveRoundProgress } from "@/lib/progress";
import type { AgeSkin, LessonStepParams, Letter, LetterForm } from "@/lib/types";
import { FORM_LABEL_DA } from "@/features/lyt-og-find/engine";
import { TraceCanvas } from "./TraceCanvas";
import { SKIN_TUNING, isCleanTrace } from "./tracing";
import type { CompanionMood } from "./NourCompanion";

const NourCompanion = lazy(() => import("./NourCompanion"));

// ----------------------------------------------------------------------------
// Runde-model
// ----------------------------------------------------------------------------

interface TraceStep {
  letter: Letter;
  form: LetterForm;
  glyph: string;
}

function glyphFor(l: Letter, form: LetterForm): string {
  switch (form) {
    case "isolated":
      return l.form_isolated;
    case "initial":
      return l.form_initial;
    case "medial":
      return l.form_medial;
    case "final":
      return l.form_final;
  }
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Trin-tilstand: spor lektionens NYE bogstaver.
 * formsMode (pensum-trin 6, kun teen): ét forbinder-bogstav fra lektionen
 * i alle fire former; ellers isolerede former af de nye bogstaver,
 * begrænset til questionCount.
 */
function buildLessonSteps(
  step: LessonStepParams,
  letters: Letter[],
): TraceStep[] {
  const newLetters = letters
    .filter((l) => step.letterPositions.includes(l.position))
    .sort((a, b) => a.position - b.position);
  if (newLetters.length === 0) return [];

  if (step.formsMode) {
    const target =
      newLetters.find((l) => l.is_connector) ?? newLetters[0];
    return (["isolated", "initial", "medial", "final"] as const).map(
      (form) => ({ letter: target, form, glyph: glyphFor(target, form) }),
    );
  }

  return newLetters
    .slice(0, Math.max(2, step.questionCount))
    .map((l) => ({
      letter: l,
      form: "isolated" as const,
      glyph: l.form_isolated,
    }));
}

function buildSteps(skin: AgeSkin, letters: Letter[]): TraceStep[] {
  switch (skin) {
    case "soft": {
      const pool = [...letters]
        .sort((a, b) => a.position - b.position)
        .slice(0, 12);
      return shuffle(pool)
        .slice(0, 4)
        .map((l) => ({ letter: l, form: "isolated" as const, glyph: l.form_isolated }));
    }
    case "mid":
      return shuffle(letters)
        .slice(0, 5)
        .map((l) => ({ letter: l, form: "isolated" as const, glyph: l.form_isolated }));
    case "teen": {
      // Ét forbinder-bogstav i alle fire former — formerne er kun
      // meningsfuldt forskellige for forbindere.
      const connectors = letters.filter((l) => l.is_connector);
      const target = shuffle(connectors)[0] ?? letters[0];
      return (["isolated", "initial", "medial", "final"] as const).map(
        (form) => ({ letter: target, form, glyph: glyphFor(target, form) }),
      );
    }
  }
}

const XP_CLEAN = 10;
const XP_DONE = 5;

// ----------------------------------------------------------------------------
// Komponent
// ----------------------------------------------------------------------------

export interface TegnBogstavetGameProps {
  skin: AgeSkin;
  profileId?: string;
  lessonId?: string;
  onExit?: () => void;
  /** Trin-tilstand (lektions-rammen ejer progress og navigation) */
  step?: LessonStepParams;
  onRoundComplete?: (earnedXp: number) => void;
}

export function TegnBogstavetGame({
  skin,
  profileId,
  lessonId,
  onExit,
  step: lessonStep,
  onRoundComplete,
}: TegnBogstavetGameProps) {
  const tuning = SKIN_TUNING[skin];

  const [letters, setLetters] = useState<Letter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audioUrlById, setAudioUrlById] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<"tracing" | "step_done" | "round_done">(
    "tracing",
  );
  const [coverage, setCoverage] = useState(0);
  const [offRatio, setOffRatio] = useState(0);
  const [mood, setMood] = useState<CompanionMood>("idle");
  const [xp, setXp] = useState(0);
  const [cleanCount, setCleanCount] = useState(0);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [, setMilestone] = useState(0);
  const [cheerPulse, setCheerPulse] = useState(0);

  const player = useMemo(() => createAudioPlayer(), []);

  // --------------------------------------------------------------------------
  // Hentning
  // --------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await supabase.from("letters").select("*").order("position");
      if (cancelled) return;
      if (res.error || !res.data?.length) {
        setLoadError(res.error?.message ?? "Ingen bogstaver fundet.");
        return;
      }
      // Stemmevalg: foretrukket spor vælges ved hentning
      const ls = (res.data as Letter[]).map((l) => ({
        ...l,
        audio_media_id: preferredAudioId(l),
      }));

      const mediaIds = ls
        .map((l) => l.audio_media_id)
        .filter((id): id is string => id !== null);
      if (mediaIds.length > 0) {
        const mediaRes = await supabase
          .from("media")
          .select("id,url")
          .in("id", mediaIds);
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const m of mediaRes.data ?? [])
          map.set(m.id as string, m.url as string);
        setAudioUrlById(map);
      }
      setLetters(ls);
    }
    void load();
    return () => {
      cancelled = true;
      player.dispose();
    };
  }, [player]);

  const startRound = useCallback(() => {
    if (!letters) return;
    setSteps(
      lessonStep
        ? buildLessonSteps(lessonStep, letters)
        : buildSteps(skin, letters),
    );
    setStepIndex(0);
    setPhase("tracing");
    setCoverage(0);
    setOffRatio(0);
    setMood("idle");
    setCheerPulse(0);
    setXp(0);
    setCleanCount(0);
    setSaveState("idle");
    setMilestone(0);
  }, [letters, skin, lessonStep]);

  useEffect(() => {
    if (letters) startRound();
  }, [letters, startRound]);

  const step = steps[stepIndex] ?? null;

  // --------------------------------------------------------------------------
  // Lyd: sig bogstavets navn når et nyt trin starter (fil → TTS)
  // --------------------------------------------------------------------------
  const sayLetter = useCallback(() => {
    if (!step) return;
    const url = step.letter.audio_media_id
      ? audioUrlById.get(step.letter.audio_media_id)
      : undefined;
    if (url) void player.play(url);
    else void speak(step.letter.name_ar);
  }, [step, audioUrlById, player]);

  useEffect(() => {
    if (phase === "tracing" && step) sayLetter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, steps]);

  // --------------------------------------------------------------------------
  // Tracing-callbacks
  // --------------------------------------------------------------------------
  const handleProgress = useCallback(
    (cov: number, off: number) => {
      setCoverage(cov);
      setOffRatio(off);
      // Nouri hepper ved 25/50/75 %-milepæle
      const m = cov >= 0.75 ? 3 : cov >= 0.5 ? 2 : cov >= 0.25 ? 1 : 0;
      setMilestone((prev) => {
        if (m > prev) {
          setMood("cheer");
          setCheerPulse((n) => n + 1);
        }
        return Math.max(prev, m);
      });
    },
    [],
  );

  const handleComplete = useCallback(() => {
    if (!step) return;
    setMood("celebrate");
    const clean = isCleanTrace(coverage, offRatio, skin);
    if (skin !== "soft") {
      setXp((n) => n + (clean ? XP_CLEAN : XP_DONE));
      if (clean) setCleanCount((n) => n + 1);
    }
    setPhase("step_done");
  }, [step, coverage, offRatio, skin]);

  const nextStep = useCallback(() => {
    if (stepIndex + 1 >= steps.length) {
      setPhase("round_done");
    } else {
      setStepIndex((i) => i + 1);
      setPhase("tracing");
      setCoverage(0);
      setOffRatio(0);
      setMood("idle");
      setMilestone(0);
    }
  }, [stepIndex, steps.length]);

  // --------------------------------------------------------------------------
  // Progress-gem ved rundens afslutning
  // --------------------------------------------------------------------------
  // Trin-tilstand: rammen ejer progress — meld færdig i stedet for at gemme
  const completeReportedRef = useRef(false);
  useEffect(() => {
    if (phase === "tracing") completeReportedRef.current = false;
  }, [phase]);
  useEffect(() => {
    if (phase !== "round_done" || !onRoundComplete) return;
    if (completeReportedRef.current) return;
    completeReportedRef.current = true;
    onRoundComplete(xp);
  }, [phase, onRoundComplete, xp]);

  useEffect(() => {
    if (phase !== "round_done" || !profileId || !lessonId || lessonStep) return;
    if (saveState !== "idle") return;
    let cancelled = false;
    setSaveState("saving");
    void saveRoundProgress(profileId, lessonId, xp).then(({ ok }) => {
      if (!cancelled) setSaveState(ok ? "saved" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [phase, profileId, lessonId, xp, saveState, lessonStep]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  if (loadError) {
    return (
      <Shell skin={skin}>
        <div className="py-16 text-center">
          <p className="font-semibold text-danger">Noget gik galt</p>
          <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
        </div>
      </Shell>
    );
  }

  if (!letters || !step) {
    return (
      <Shell skin={skin}>
        <p className="py-16 text-center text-ink-soft">Henter bogstaver …</p>
      </Shell>
    );
  }

  if (phase === "round_done") {
    return (
      <Shell skin={skin}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Suspense fallback={<GlowFallback />}>
            <NourCompanion mood="celebrate" size={140} />
          </Suspense>
          <h2
            className={`font-bold text-night ${skin === "soft" ? "text-3xl" : "text-2xl"}`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {skin === "soft"
              ? "Alle bogstaver tændt!"
              : skin === "mid"
                ? "Flot skrevet!"
                : "Runde færdig"}
          </h2>
          {skin !== "soft" ? (
            <div className="flex items-center gap-4 text-ink">
              <span className="font-semibold tabular-nums">
                {cleanCount}/{steps.length} rene streger
              </span>
              <span
                className="rounded-full px-3 py-1 font-bold text-white"
                style={{ background: "var(--color-nour)" }}
              >
                +{xp} XP
              </span>
            </div>
          ) : null}
          {profileId && lessonId ? (
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              {saveState === "saving" ? (
                "Gemmer fremskridt …"
              ) : saveState === "saved" ? (
                <>
                  <Flame
                    className="size-4"
                    style={{ color: "var(--color-nour)" }}
                  />
                  Fremskridt gemt
                </>
              ) : saveState === "error" ? (
                "Fremskridt kunne ikke gemmes — det tæller stadig for dig!"
              ) : null}
            </p>
          ) : null}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={startRound}
              className="flex items-center gap-2 rounded-(--radius-skin) px-6 py-3 font-bold text-white transition-transform active:scale-95"
              style={{ background: "var(--color-valley)" }}
            >
              <RotateCcw className="size-5" /> Tegn igen
            </button>
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="rounded-(--radius-skin) bg-dawn-deep px-6 py-3 font-bold text-ink transition-transform active:scale-95"
              >
                Tilbage
              </button>
            ) : null}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell skin={skin}>
      <div className="flex flex-col gap-4">
        {/* Toplinje: instruktion + Nouri */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`font-semibold text-ink ${
                skin === "soft" ? "text-2xl" : skin === "mid" ? "text-xl" : "text-base"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {skin === "teen"
                ? `${step.letter.name_da} — ${FORM_LABEL_DA[step.form]}`
                : `Tegn ${step.letter.name_da}!`}
            </p>
            <p className="truncate text-sm text-ink-soft">
              {step.letter.sound_hint_da}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={sayLetter}
              aria-label="Hør bogstavet igen"
              className="flex size-11 items-center justify-center rounded-full text-white transition-transform active:scale-95"
              style={{ background: "var(--color-valley)" }}
            >
              <Volume2 className="size-5" />
            </button>
            <Suspense fallback={<GlowFallback />}>
              <NourCompanion mood={mood} pulse={cheerPulse} size={skin === "soft" ? 110 : 90} />
            </Suspense>
          </div>
        </div>

        {/* Lærredet — her males lyset */}
        <TraceCanvas
          key={`${step.letter.id}-${step.form}`}
          glyph={step.glyph}
          brushRadius={tuning.brushRadius}
          baseScale={tuning.fontScale}
          threshold={tuning.completion}
          locked={phase === "step_done"}
          onProgress={handleProgress}
          onComplete={handleComplete}
          className="rounded-(--radius-skin)"
        />

        {/* Lys-måler + (teen) præcision */}
        <div className="flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-dawn-deep">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${Math.min(100, (coverage / tuning.completion) * 100)}%`,
                background:
                  "linear-gradient(90deg, var(--color-nour), var(--color-nour-soft))",
              }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-ink-soft">
            {stepIndex + 1}/{steps.length}
          </span>
        </div>
        {skin === "teen" ? (
          <p className="text-right text-xs tabular-nums text-ink-soft">
            Præcision: {Math.round((1 - offRatio) * 100)} %
          </p>
        ) : null}
        {skin !== "teen" && offRatio > 0.5 && coverage < tuning.completion ? (
          <p className="text-center text-sm text-ink-soft">
            Prøv at blive inde i bogstavet — så vokser lyset hurtigere ✨
          </p>
        ) : null}

        {/* Trin færdigt */}
        {phase === "step_done" ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-center font-semibold text-ink">
              {skin === "soft"
                ? `${step.letter.name_da} lyser nu! ⭐`
                : isCleanTrace(coverage, offRatio, skin)
                  ? `Ren streg — flot ${step.letter.name_da}!`
                  : `${step.letter.name_da} er tændt!`}
            </p>
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 rounded-(--radius-skin) px-6 py-3 font-bold text-white transition-transform active:scale-95"
              style={{ background: "var(--color-night)" }}
            >
              Videre <ArrowRight className="size-5" />
            </button>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

// ----------------------------------------------------------------------------
// Ramme + fallback-glød
// ----------------------------------------------------------------------------

function Shell({
  skin,
  children,
}: {
  skin: AgeSkin;
  children: React.ReactNode;
}) {
  return (
    <div
      data-age-skin={skin}
      className="mx-auto w-full max-w-xl rounded-(--radius-skin) border-2 bg-white p-5 sm:p-7"
      style={{ borderColor: "var(--color-valley)" }}
    >
      {children}
    </div>
  );
}

/** 2D-glød mens Three.js-chunken henter (og som reduceret fallback) */
function GlowFallback() {
  return (
    <div
      aria-hidden
      className="size-16 rounded-full"
      style={{
        background:
          "radial-gradient(circle, var(--color-nour-soft) 0%, var(--color-nour) 55%, transparent 75%)",
      }}
    />
  );
}
