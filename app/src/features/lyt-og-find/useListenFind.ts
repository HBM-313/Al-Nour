/**
 * useListenFind — datahentning + spiltilstand + progress-gem.
 *
 * Datahentning (3 kald ved spilstart, derefter alt i hukommelsen):
 *   1. letters (alle, hija'i-orden)
 *   2. vocabulary (is_published, level <= barnets niveau)
 *   3. media-URL'er for alle fundne audio_media_id i ét in()-opslag
 *
 * Progress (valgfrit — kun når profileId + lessonId er givet):
 *   Læs eksisterende række → dags-baseret streak → upsert på
 *   UNIQUE(profile_id, lesson_id). XP akkumuleres.
 *
 * MUREN: kun letters/vocabulary/media/progress berøres. `content` (og dermed
 * aqidah) læses/skrives aldrig fra dette spil.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { preferredAudioId } from "@/lib/voicePref";
import type { AgeSkin, LessonStepParams, Letter, VocabularyWord } from "@/lib/types";
import { buildRound, buildStepRound, type Question } from "./engine";
import { canSpeak, createAudioPlayer, speakArabic, stopSpeaking } from "@/lib/audio";
import { saveRoundProgress } from "@/lib/progress";
import { recordItemStat } from "@/lib/itemStats";
import { useT } from "@/lib/i18n";

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

export type SaveState = "idle" | "saving" | "saved" | "queued" | "error";

export interface AnswerResult {
  correct: boolean;
  firstTry: boolean;
}

export interface UseListenFindOptions {
  skin: AgeSkin;
  /** Barnets sprogniveau (1–4) — filtrerer ordforråd */
  level: number;
  /** Uden disse to kører spillet fint, men gemmer ikke fremskridt */
  profileId?: string;
  lessonId?: string;
  /**
   * Trin-tilstand: runden bygges af lektions-parametre, spillets eget
   * progress-gem slås fra (lektions-rammen ejer gem), og onRoundComplete
   * kaldes når runden er færdig.
   */
  step?: LessonStepParams;
  onRoundComplete?: (earnedXp: number) => void;
}

/** XP-regler (mid/teen): fuldt point ved første forsøg, halvt ellers. */
const XP_FIRST_TRY = 10;
const XP_RETRY = 5;

export function useListenFind(options: UseListenFindOptions) {
  const { skin, level, profileId, lessonId, step, onRoundComplete } = options;
  const t = useT("da");

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [xp, setXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [triedChoiceIds, setTriedChoiceIds] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [audioAvailable, setAudioAvailable] = useState(true);
  // TTS-pladsholder: sættes til true hvis browseren beviseligt ikke kan
  // afspille arabisk tale (fx ingen arabisk stemme) — så viser UI'et
  // tekst-fallback i stedet for stilhed. Kun sat ved BRUGER-udløst forsøg,
  // da autoplay-blokering ellers ville give falsk negativ.
  const [ttsUnavailable, setTtsUnavailable] = useState(!canSpeak());

  const player = useMemo(() => createAudioPlayer(), []);
  const dataRef = useRef<{
    letters: Letter[];
    vocabulary: VocabularyWord[];
    audioUrlById: Map<string, string>;
  } | null>(null);

  // --------------------------------------------------------------------------
  // Hentning + rundeopbygning
  // --------------------------------------------------------------------------

  const startRound = useCallback(() => {
    const data = dataRef.current;
    if (!data) return;
    const round = step
      ? buildStepRound({ skin, ...data }, step)
      : buildRound({ skin, ...data });
    completeReportedRef.current = false;
    setQuestions(round);
    setIndex(0);
    setPhase("playing");
    setXp(0);
    setCorrectCount(0);
    setTriedChoiceIds(new Set());
    setAnswered(false);
    setSaveState("idle");
  }, [skin, step]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState({ status: "loading" });

      const [lettersRes, vocabRes] = await Promise.all([
        supabase.from("letters").select("*").order("position"),
        supabase
          .from("vocabulary")
          .select("*")
          .eq("is_published", true)
          .lte("level", level),
      ]);

      if (cancelled) return;
      if (lettersRes.error || !lettersRes.data?.length) {
        setLoadState({
          status: "error",
          message: lettersRes.error?.message ?? t.lytOgFind.noLettersFound,
        });
        return;
      }

      // Stemmevalg (Habibah/Ahmed): audio_media_id omskrives ved hentning
      // til det foretrukne spor — resten af spillet er stemme-agnostisk.
      const letters = (lettersRes.data as Letter[]).map((l) => ({
        ...l,
        audio_media_id: preferredAudioId(l),
      }));
      const vocabulary = ((vocabRes.data ?? []) as VocabularyWord[]).map(
        (w) => ({ ...w, audio_media_id: preferredAudioId(w) }),
      );

      // Slå lyd-URL'er op i ét kald. Lyd-reglen: filer er frit udskiftelige
      // (TTS/AI eller human) — triggeren garanterer aldrig-recitation.
      const mediaIds = [
        ...letters.map((l) => l.audio_media_id),
        ...vocabulary.map((w) => w.audio_media_id),
      ].filter((id): id is string => id !== null);

      const audioUrlById = new Map<string, string>();
      if (mediaIds.length > 0) {
        const mediaRes = await supabase
          .from("media")
          .select("id,url")
          .in("id", mediaIds);
        if (cancelled) return;
        for (const m of mediaRes.data ?? []) {
          audioUrlById.set(m.id as string, m.url as string);
        }
      }
      setAudioAvailable(audioUrlById.size > 0);

      dataRef.current = { letters, vocabulary, audioUrlById };
      setLoadState({ status: "ready" });
    }

    void load();
    return () => {
      cancelled = true;
      player.dispose();
    };
  }, [level, player, t]);

  // Byg (ny) runde når data er klar eller skind skifter
  useEffect(() => {
    if (loadState.status === "ready") startRound();
  }, [loadState.status, startRound]);

  // --------------------------------------------------------------------------
  // Spilhandlinger
  // --------------------------------------------------------------------------

  const current: Question | null = questions[index] ?? null;

  /**
   * Afspil prompten. Prioritering (lyd-reglen 2026-07-14):
   *   1. medie-fil fra media-tabellen (human eller AI — frit udskiftelig)
   *   2. browser-TTS som pladsholder
   *   3. (UI'et viser tekst-fallback hvis begge mangler/fejler)
   * fromUser=true når barnet selv trykkede — kun dér må en TTS-fejl
   * konkludere "TTS virker ikke her" (autoplay-blokering er ikke en fejl).
   */
  const playPrompt = useCallback(
    async (fromUser = false) => {
      if (!current) return;
      if (current.audioUrl) {
        void player.play(current.audioUrl);
        return;
      }
      if (current.ttsText && !ttsUnavailable) {
        // Arabisk stemme → arabisk; ellers dansk navn ("Alif") med
        // enhedens egen stemme; ellers tekst-fallback i UI'et.
        const via = await speakArabic(current.ttsText, current.fallback.titleDa);
        if (via === "none" && fromUser) setTtsUnavailable(true);
      }
    },
    [current, player, ttsUnavailable],
  );

  // Afspil prompten automatisk ved nyt spørgsmål (best effort; autoplay kan
  // være blokeret indtil første tryk — lyd-knappen findes altid).
  useEffect(() => {
    if (phase === "playing") void playPrompt(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current]);

  /**
   * Svar på et valg.
   * - Korrekt: markér besvaret, tildel XP (mid/teen-semantik), tæl op.
   * - Forkert i soft-skind: valget deaktiveres blot; barnet prøver videre
   *   (næsten ingen "forkert"-følelse — runden ender altid i succes).
   * - Forkert i mid/teen: spørgsmålet låses, det rigtige svar fremhæves.
   */
  const answer = useCallback(
    (choiceId: string): AnswerResult | null => {
      if (!current || answered) return null;
      const choice = current.choices.find((c) => c.id === choiceId);
      if (!choice || triedChoiceIds.has(choiceId)) return null;

      const firstTry = triedChoiceIds.size === 0;
      // Item-stat (D1): item_type/id udledes af spørgsmålet uanset kind —
      // "word" er ordforråd, "letter"/"letter_form" er samme bogstav.
      const targetId = current.choices.find((c) => c.isCorrect)?.id;
      const itemType = current.kind === "word" ? "vocabulary" : "letter";

      if (choice.isCorrect) {
        setAnswered(true);
        setCorrectCount((n) => n + (firstTry ? 1 : 0));
        setXp((n) => n + (firstTry ? XP_FIRST_TRY : XP_RETRY));
        if (profileId && targetId) {
          void recordItemStat(profileId, itemType, targetId, firstTry);
        }
        return { correct: true, firstTry };
      }

      setTriedChoiceIds((prev) => new Set(prev).add(choiceId));
      if (skin !== "soft") {
        // Mid/teen: ét forsøg — lås spørgsmålet og vis det rigtige svar.
        setAnswered(true);
        if (profileId && targetId) {
          void recordItemStat(profileId, itemType, targetId, false);
        }
      }
      return { correct: false, firstTry };
    },
    [current, answered, triedChoiceIds, skin, profileId],
  );

  const next = useCallback(() => {
    player.stop();
    stopSpeaking();
    if (index + 1 >= questions.length) {
      setPhase("done");
    } else {
      setIndex((i) => i + 1);
      setTriedChoiceIds(new Set());
      setAnswered(false);
    }
  }, [index, questions.length, player]);

  // --------------------------------------------------------------------------
  // Progress-gem (kører én gang når runden er færdig)
  // --------------------------------------------------------------------------

  // Trin-tilstand: rammen ejer progress — meld færdig i stedet for at gemme
  const completeReportedRef = useRef(false);
  useEffect(() => {
    if (phase !== "done" || !onRoundComplete) return;
    if (completeReportedRef.current) return;
    completeReportedRef.current = true;
    onRoundComplete(xp);
  }, [phase, onRoundComplete, xp]);

  useEffect(() => {
    if (phase !== "done" || !profileId || !lessonId || step) return;
    if (saveState !== "idle") return;

    let cancelled = false;

    setSaveState("saving");
    void saveRoundProgress(profileId, lessonId, xp).then(({ ok, pending }) => {
      if (!cancelled) setSaveState(!ok ? "error" : pending ? "queued" : "saved");
    });
    return () => {
      cancelled = true;
    };
  }, [phase, profileId, lessonId, xp, saveState, step]);

  return {
    loadState,
    phase,
    questions,
    index,
    current,
    answered,
    triedChoiceIds,
    xp,
    correctCount,
    saveState,
    audioAvailable,
    ttsUnavailable,
    playPrompt,
    answer,
    next,
    restart: startRound,
  };
}
