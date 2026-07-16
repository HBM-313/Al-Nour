/**
 * useLesson — trin-motoren der binder de tre spil sammen til lektioner.
 *
 * En lektion = sekvens af trin (lesson_steps) med stigende sværhedsgrad.
 * Sessioner er 5–30 min efter barnets valg: der gemmes EFTER HVERT TRIN
 * (progress.current_step), så "Stop her" aldrig koster fremskridt, og
 * "Fortsæt hvor du slap" altid virker.
 *
 * Aldersskind: stepsForSkin filtrerer trinlisten (soft 4, mid 5, teen 6
 * i standard-pensum) — samme lektion, tre længder.
 *
 * Uden profileId (fx før login er bygget) kører motoren i ren hukommelse:
 * spilbart, men uden gem på tværs af sessioner.
 *
 * MUREN: læser lessons/lesson_steps (kurrikulum, AI-tilladt verden),
 * skriver kun progress. Aldrig content/aqidah.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { saveStepProgress } from "@/lib/progress";
import {
  stepsForSkin,
  stepParamsFrom,
  type AgeSkin,
  type Lesson,
  type LessonStep,
  type LessonStepParams,
} from "@/lib/types";

export type LessonLoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

export type LessonPhase = "intro" | "step" | "breather" | "done";

export type StepSaveState = "idle" | "saving" | "saved" | "error";

export interface UseLessonOptions {
  lessonId: string;
  skin: AgeSkin;
  /** Uden denne kører lektionen i hukommelsen (intet gem på tværs af sessioner) */
  profileId?: string;
}

export function useLesson(options: UseLessonOptions) {
  const { lessonId, skin, profileId } = options;

  const [loadState, setLoadState] = useState<LessonLoadState>({
    status: "loading",
  });
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [steps, setSteps] = useState<LessonStep[]>([]);
  const [phase, setPhase] = useState<LessonPhase>("intro");
  const [stepIndex, setStepIndex] = useState(0);
  /** Trin genoptaget fra databasen ("fortsæt hvor du slap") */
  const [resumeStep, setResumeStep] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [saveState, setSaveState] = useState<StepSaveState>("idle");

  const allStepsRef = useRef<LessonStep[]>([]);

  // --------------------------------------------------------------------------
  // Hentning: lektion + trin (+ genoptag fra progress)
  // --------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState({ status: "loading" });

      const [lessonRes, stepsRes] = await Promise.all([
        supabase.from("lessons").select("*").eq("id", lessonId).single(),
        supabase
          .from("lesson_steps")
          .select("*")
          .eq("lesson_id", lessonId)
          .order("order_index"),
      ]);

      if (cancelled) return;
      if (lessonRes.error || !lessonRes.data) {
        setLoadState({
          status: "error",
          message: lessonRes.error?.message ?? "Lektionen blev ikke fundet.",
        });
        return;
      }
      if (stepsRes.error || !stepsRes.data || stepsRes.data.length === 0) {
        setLoadState({
          status: "error",
          message: stepsRes.error?.message ?? "Lektionen har ingen trin endnu.",
        });
        return;
      }

      allStepsRef.current = stepsRes.data as LessonStep[];
      setLesson(lessonRes.data as Lesson);

      // Genoptag fra databasen — current_step er index i SKIND-filtreret liste
      let resume = 0;
      if (profileId) {
        const prog = await supabase
          .from("progress")
          .select("current_step, status")
          .eq("profile_id", profileId)
          .eq("lesson_id", lessonId)
          .maybeSingle();
        if (cancelled) return;
        if (prog.data && prog.data.status === "in_progress") {
          resume = prog.data.current_step ?? 0;
        }
      }

      const skinSteps = stepsForSkin(allStepsRef.current, skin);
      setSteps(skinSteps);
      setResumeStep(Math.min(resume, Math.max(0, skinSteps.length - 1)));
      setStepIndex(0);
      setSessionXp(0);
      setPhase("intro");
      setLoadState({ status: "ready" });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId, profileId, skin]);

  // Skind-skift midt i en session: genfiltrér trinlisten
  useEffect(() => {
    if (allStepsRef.current.length === 0) return;
    const skinSteps = stepsForSkin(allStepsRef.current, skin);
    setSteps(skinSteps);
    setStepIndex((i) => Math.min(i, Math.max(0, skinSteps.length - 1)));
    setResumeStep((r) => Math.min(r, Math.max(0, skinSteps.length - 1)));
  }, [skin]);

  // --------------------------------------------------------------------------
  // Flow
  // --------------------------------------------------------------------------

  const start = useCallback(
    (fromStep?: number) => {
      setStepIndex(fromStep ?? resumeStep);
      setSessionXp(0);
      setPhase("step");
    },
    [resumeStep],
  );

  /** Kaldes af spillet (onRoundComplete) når trinnets runde er færdig. */
  const completeStep = useCallback(
    (earnedXp: number) => {
      const nextIndex = stepIndex + 1;
      const finished = nextIndex >= steps.length;
      setSessionXp((x) => x + earnedXp);
      setPhase(finished ? "done" : "breather");
      setResumeStep(finished ? 0 : nextIndex);

      // Gem pr. trin — fire-and-forget med synlig status
      if (profileId) {
        setSaveState("saving");
        void saveStepProgress(
          profileId,
          lessonId,
          nextIndex,
          earnedXp,
          finished,
        ).then(({ ok }) => setSaveState(ok ? "saved" : "error"));
      }
    },
    [stepIndex, steps.length, profileId, lessonId],
  );

  /** "Videre"-knappen i pusterummet. */
  const continueToNext = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    setSaveState("idle");
    setPhase("step");
  }, [steps.length]);

  const restart = useCallback(() => {
    setStepIndex(0);
    setResumeStep(0);
    setSessionXp(0);
    setSaveState("idle");
    setPhase("step");
  }, []);

  const currentStep: LessonStep | null = steps[stepIndex] ?? null;
  const currentParams: LessonStepParams | null = currentStep
    ? stepParamsFrom(currentStep)
    : null;

  return {
    loadState,
    lesson,
    steps,
    phase,
    stepIndex,
    resumeStep,
    sessionXp,
    saveState,
    currentStep,
    currentParams,
    canResume: resumeStep > 0,
    start,
    completeStep,
    continueToNext,
    restart,
  };
}
