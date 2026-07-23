/**
 * LessonScreen — rammen om en lektion (ejer-godkendt flow, 2026-07-16).
 *
 * intro → [spil-trin → pusterum]* → fejring
 *
 * Pusterummet er ét skærmbillede med to valg: "Videre" (standardvejen) og
 * "Stop her — alt er gemt" (diskret men altid til stede, ingen skyld).
 * Lanterne-prikkerne øverst viser præcis hvor langt man er. Progress
 * gemmes pr. trin i useLesson — dét er 5–30-minutters-kontrakten.
 *
 * Spillene kører UINDPAKKEDE som trin (fuld mekanik, animationer, lyd) med
 * trin-parametre fra lesson_steps; rammen ejer kun sekvens og gem.
 *
 * MUREN: Bogstavernes Dal, AI-tilladt verden. Aldrig content/aqidah.
 */

import { useMemo } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { AgeSkin } from "@/lib/types";
import { ListenFindGame } from "@/features/lyt-og-find/ListenFindGame";
import { TegnBogstavetGame } from "@/features/tegn-bogstavet/TegnBogstavetGame";
import { MatchPairsGame } from "@/features/match-par/MatchPairsGame";
import { ErrorBoundary } from "@/components/error-boundary";
import { useT, type Dictionary } from "@/lib/i18n";
import { useLesson } from "./useLesson";
import "./lektion.css";

export interface LessonScreenProps {
  lessonId: string;
  skin: AgeSkin;
  /** Barnets sprogniveau (1–4), fra profilen */
  level?: number;
  showTransliteration?: boolean;
  /** Uden denne spilles uden gem på tværs af sessioner */
  profileId?: string;
  /** Tilbage til verdenskortet/lektionslisten */
  onExit: () => void;
}

const NIGHT = "#0b1526";

export function LessonScreen({
  lessonId,
  skin,
  level = 1,
  showTransliteration = true,
  profileId,
  onExit,
}: LessonScreenProps) {
  const lesson = useLesson({ lessonId, skin, profileId });
  const t = useT("da");

  const stars = useMemo(
    () =>
      Array.from({ length: 26 }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 30}%`,
        size: Math.random() * 2 + 1,
        opacity: (Math.random() * 0.5 + 0.2).toFixed(2),
      })),
    [],
  );

  const total = lesson.steps.length;
  const lit =
    lesson.phase === "done"
      ? total
      : lesson.phase === "breather"
        ? lesson.stepIndex + 1
        : lesson.stepIndex;
  const lightRatio = total > 0 ? lit / total : 0;

  return (
    <div
      data-age-skin={skin}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-(--radius-skin) p-4 sm:p-5"
      style={{ background: NIGHT, isolation: "isolate" }}
    >
      {/* Varmt lys der vokser med trinnene */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{ background: "#3a2a12", opacity: lightRatio * 0.45 }}
      />
      {stars.map((s, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="absolute rounded-full"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            background: "#cfe3ff",
            opacity: s.opacity,
          }}
        />
      ))}

      <div className="relative">
        {/* Titel + tilbage */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2
            className="me-auto text-base font-bold sm:text-lg"
            style={{ color: "#f4ecd8", fontFamily: "var(--font-display)" }}
          >
            {lesson.lesson?.title_da ?? t.lektion.fallbackTitle}{" "}
            {lesson.lesson?.title_ar && (
              <span
                dir="rtl"
                lang="ar"
                className="arabic text-base"
                style={{ color: "#e8c877" }}
              >
                {lesson.lesson.title_ar}
              </span>
            )}
          </h2>
          <button
            onClick={onExit}
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.1)", color: "#dbe4f2" }}
          >
            {t.lektion.backToMap}
          </button>
        </div>

        {/* Lanterne-prikker: hvor langt er vi */}
        {total > 0 && (
          <div
            className="mb-3 flex items-center justify-center gap-2"
            role="progressbar"
            aria-valuenow={lit}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={t.lektion.stepsLit(lit, total)}
          >
            {lesson.steps.map((s, i) => (
              <span key={s.id} className="flex items-center gap-2">
                {i > 0 && (
                  <span className={`lk-link ${i <= lit - 1 ? "lk-on" : ""}`} />
                )}
                <span
                  className={`lk-dot ${i < lit ? "lk-on" : ""} ${
                    i === lesson.stepIndex &&
                    (lesson.phase === "step" || lesson.phase === "intro") &&
                    i >= lit
                      ? "lk-cur"
                      : ""
                  }`}
                />
              </span>
            ))}
          </div>
        )}

        {/* Faser */}
        {lesson.loadState.status === "loading" && (
          <p className="py-16 text-center" style={{ color: "#b9c6da" }}>
            {t.lektion.loadingLanterns}
          </p>
        )}

        {lesson.loadState.status === "error" && (
          <div className="py-16 text-center">
            <p className="font-semibold" style={{ color: "#f09595" }}>
              {t.common.somethingWrong}
            </p>
            <p className="mt-1 text-sm" style={{ color: "#b9c6da" }}>
              {lesson.loadState.message}
            </p>
          </div>
        )}

        {lesson.loadState.status === "ready" && lesson.phase === "intro" && (
          <Intro lesson={lesson} skin={skin} t={t} />
        )}

        {lesson.loadState.status === "ready" &&
          lesson.phase === "step" &&
          lesson.currentStep &&
          lesson.currentParams && (
            <div className="lk-fade">
              <p
                className="mb-2 text-center text-sm font-semibold"
                style={{ color: "#ffe3a1" }}
              >
                {t.lektion.stepOf(lesson.stepIndex + 1, total, lesson.currentStep.title_da)}
              </p>
              {lesson.currentStep.game_type === "lyt_og_find" && (
                <ErrorBoundary
                  scope="game"
                  skin={skin}
                  component="ListenFindGame"
                  onExit={onExit}
                >
                  <ListenFindGame
                    skin={skin}
                    level={level}
                    showTransliteration={showTransliteration}
                    step={lesson.currentParams}
                    onRoundComplete={lesson.completeStep}
                  />
                </ErrorBoundary>
              )}
              {lesson.currentStep.game_type === "tegn_bogstavet" && (
                <ErrorBoundary
                  scope="game"
                  skin={skin}
                  component="TegnBogstavetGame"
                  onExit={onExit}
                >
                  <TegnBogstavetGame
                    skin={skin}
                    step={lesson.currentParams}
                    onRoundComplete={lesson.completeStep}
                  />
                </ErrorBoundary>
              )}
              {lesson.currentStep.game_type === "match_par" && (
                <ErrorBoundary
                  scope="game"
                  skin={skin}
                  component="MatchPairsGame"
                  onExit={onExit}
                >
                  <MatchPairsGame
                    skin={skin}
                    level={level}
                    showTransliteration={showTransliteration}
                    step={lesson.currentParams}
                    onRoundComplete={lesson.completeStep}
                  />
                </ErrorBoundary>
              )}
            </div>
          )}

        {lesson.loadState.status === "ready" &&
          lesson.phase === "breather" && (
            <Breather lesson={lesson} skin={skin} onExit={onExit} t={t} />
          )}

        {lesson.loadState.status === "ready" && lesson.phase === "done" && (
          <Done lesson={lesson} skin={skin} onExit={onExit} t={t} />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Faser
// ----------------------------------------------------------------------------

type LessonState = ReturnType<typeof useLesson>;

function Intro({ lesson, skin, t }: { lesson: LessonState; skin: AgeSkin; t: Dictionary }) {
  return (
    <div className="lk-fade py-6 text-center">
      {lesson.lesson?.title_ar && (
        <p
          dir="rtl"
          lang="ar"
          className="arabic text-5xl"
          style={{
            color: "#ffe9b8",
            textShadow: "0 0 24px rgba(240, 180, 41, 0.45)",
            letterSpacing: "0.12em",
          }}
        >
          {lesson.lesson.title_ar}
        </p>
      )}
      <p className="mt-3 text-sm" style={{ color: "#b9c6da" }}>
        {t.lektion.introStepsCount(lesson.steps.length)}
        <br />
        {t.lektion.introStopAnytime}
      </p>
      <div className="mt-5 flex flex-col items-center gap-2">
        <button
          onClick={() => lesson.start()}
          className="rounded-full px-7 py-3.5 text-base font-bold transition-transform active:scale-95"
          style={{ background: "var(--color-nour)", color: "#3d2a00" }}
        >
          {lesson.canResume
            ? t.lektion.resumeAt(lesson.resumeStep + 1)
            : t.lektion.startLesson}
        </button>
        {lesson.canResume && (
          <button
            onClick={() => lesson.start(0)}
            className="rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.1)", color: "#dbe4f2" }}
          >
            {t.lektion.startOver}
          </button>
        )}
      </div>
      {skin === "soft" && (
        <p className="mt-4 text-xs" style={{ color: "#8fa4c4" }}>
          {t.lektion.softIntroHint}
        </p>
      )}
    </div>
  );
}

function Breather({
  lesson,
  skin,
  onExit,
  t,
}: {
  lesson: LessonState;
  skin: AgeSkin;
  onExit: () => void;
  t: Dictionary;
}) {
  const nextStep = lesson.steps[lesson.stepIndex + 1];
  return (
    <div className="lk-fade py-6 text-center">
      <span className="lk-lantern text-5xl" aria-hidden="true">
        🏮
      </span>
      <p
        className="mt-2 text-base font-bold"
        style={{ color: "#ffe3a1", fontFamily: "var(--font-display)" }}
      >
        {t.lektion.stepLitOf(lesson.stepIndex + 1, lesson.steps.length)}
      </p>
      {skin !== "soft" && lesson.sessionXp > 0 && (
        <p className="mt-1 text-sm font-semibold" style={{ color: "#ffe3a1" }}>
          {t.lektion.xpThisSession(lesson.sessionXp)}
        </p>
      )}
      {nextStep && (
        <p className="mt-2 text-sm" style={{ color: "#b9c6da" }}>
          {t.lektion.nextLabel}{" "}
          <b style={{ color: "#dbe4f2" }}>{nextStep.title_da}</b>
        </p>
      )}
      <SaveHint lesson={lesson} t={t} />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          onClick={lesson.continueToNext}
          className="flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold transition-transform active:scale-95"
          style={{ background: "var(--color-nour)", color: "#3d2a00" }}
        >
          {t.lektion.next} <ArrowRight className="size-4" />
        </button>
        <button
          onClick={onExit}
          className="rounded-full px-5 py-3 text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.1)", color: "#dbe4f2" }}
        >
          {t.lektion.stopHereSaved}
        </button>
      </div>
    </div>
  );
}

function Done({
  lesson,
  skin,
  onExit,
  t,
}: {
  lesson: LessonState;
  skin: AgeSkin;
  onExit: () => void;
  t: Dictionary;
}) {
  return (
    <div className="lk-fade py-6 text-center">
      <span className="lk-lantern text-6xl" aria-hidden="true">
        🏮
      </span>
      <p
        className="mt-2 text-xl font-bold"
        style={{
          color: "#ffe9b8",
          textShadow: "0 0 22px rgba(255, 190, 70, 0.8)",
          fontFamily: "var(--font-display)",
        }}
      >
        {t.lektion.lessonGlows}
      </p>
      <p className="mt-2 text-sm" style={{ color: "#cdd8ea" }}>
        {t.lektion.allStepsDone(lesson.steps.length)}
        {skin !== "soft" && lesson.sessionXp > 0 && (
          <>{t.lektion.xpSuffix(lesson.sessionXp)}</>
        )}
        <br />
        {lesson.lesson?.title_ar && (
          <span dir="rtl" lang="ar" className="arabic">
            {lesson.lesson.title_ar}
          </span>
        )}{" "}
        {t.lektion.yoursNow}
      </p>
      <SaveHint lesson={lesson} t={t} />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold transition-transform active:scale-95"
          style={{ background: "var(--color-nour)", color: "#3d2a00" }}
        >
          {t.lektion.backToMap} <ArrowRight className="size-4" />
        </button>
        <button
          onClick={lesson.restart}
          className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
          style={{ background: "rgba(255,255,255,0.1)", color: "#dbe4f2" }}
        >
          <RotateCcw className="size-4" /> {t.lektion.playAgain}
        </button>
      </div>
    </div>
  );
}

function SaveHint({ lesson, t }: { lesson: LessonState; t: Dictionary }) {
  if (lesson.saveState === "idle") return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: "#8fa4c4" }}>
      {lesson.saveState === "saving" && t.lektion.savingProgress}
      {lesson.saveState === "saved" && t.lektion.progressSaved}
      {lesson.saveState === "queued" && (
        <>
          <span
            className="size-1.5 rounded-full"
            style={{ background: "var(--color-nour)" }}
            aria-hidden
          />
          {t.lektion.progressQueued}
        </>
      )}
      {lesson.saveState === "error" && t.lektion.progressError}
    </p>
  );
}
