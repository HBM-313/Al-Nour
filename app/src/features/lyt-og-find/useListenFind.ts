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
import type { AgeSkin, Letter, VocabularyWord } from "@/lib/types";
import { buildRound, type Question } from "./engine";
import { canSpeak, createAudioPlayer, speak, stopSpeaking } from "./audio";

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

export type SaveState = "idle" | "saving" | "saved" | "error";

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
}

/** XP-regler (mid/teen): fuldt point ved første forsøg, halvt ellers. */
const XP_FIRST_TRY = 10;
const XP_RETRY = 5;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isYesterday(prev: Date, now: Date): boolean {
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return dayKey(prev) === dayKey(y);
}

export function useListenFind(options: UseListenFindOptions) {
  const { skin, level, profileId, lessonId } = options;

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
    const round = buildRound({ skin, ...data });
    setQuestions(round);
    setIndex(0);
    setPhase("playing");
    setXp(0);
    setCorrectCount(0);
    setTriedChoiceIds(new Set());
    setAnswered(false);
    setSaveState("idle");
  }, [skin]);

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
          message:
            lettersRes.error?.message ?? "Ingen bogstaver fundet i databasen.",
        });
        return;
      }

      const letters = lettersRes.data as Letter[];
      const vocabulary = (vocabRes.data ?? []) as VocabularyWord[];

      // Slå lyd-URL'er op i ét kald. For letters garanterer DB-triggeren at
      // mediet er menneskeligt optaget — klienten behøver ikke gen-checke.
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
  }, [level, player]);

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
        const ok = await speak(current.ttsText);
        if (!ok && fromUser) setTtsUnavailable(true);
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

      if (choice.isCorrect) {
        setAnswered(true);
        setCorrectCount((n) => n + (firstTry ? 1 : 0));
        setXp((n) => n + (firstTry ? XP_FIRST_TRY : XP_RETRY));
        return { correct: true, firstTry };
      }

      setTriedChoiceIds((prev) => new Set(prev).add(choiceId));
      if (skin !== "soft") {
        // Mid/teen: ét forsøg — lås spørgsmålet og vis det rigtige svar.
        setAnswered(true);
      }
      return { correct: false, firstTry };
    },
    [current, answered, triedChoiceIds, skin],
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

  useEffect(() => {
    if (phase !== "done" || !profileId || !lessonId) return;
    if (saveState !== "idle") return;

    let cancelled = false;

    async function save() {
      setSaveState("saving");

      const existing = await supabase
        .from("progress")
        .select("xp, streak_count, last_completed_at")
        .eq("profile_id", profileId)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (cancelled) return;
      if (existing.error) {
        setSaveState("error");
        return;
      }

      const now = new Date();
      const prev = existing.data;
      const prevDate = prev?.last_completed_at
        ? new Date(prev.last_completed_at)
        : null;

      // Dags-streak: samme dag → uændret; i går → +1; ellers → 1.
      let streak = 1;
      if (prevDate && prev) {
        if (dayKey(prevDate) === dayKey(now)) streak = prev.streak_count;
        else if (isYesterday(prevDate, now)) streak = prev.streak_count + 1;
      }

      const { error } = await supabase.from("progress").upsert(
        {
          profile_id: profileId,
          lesson_id: lessonId,
          status: "completed",
          xp: (prev?.xp ?? 0) + xp,
          streak_count: streak,
          last_completed_at: now.toISOString(),
        },
        { onConflict: "profile_id,lesson_id" },
      );

      if (cancelled) return;
      setSaveState(error ? "error" : "saved");
    }

    void save();
    return () => {
      cancelled = true;
    };
  }, [phase, profileId, lessonId, xp, saveState]);

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
