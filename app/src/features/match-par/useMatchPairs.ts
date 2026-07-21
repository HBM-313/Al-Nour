/**
 * useMatchPairs — datahentning + spiltilstand + progress-gem for Match-par.
 *
 * Datahentning (op til 2 kald ved spilstart, derefter alt i hukommelsen):
 *   1. vocabulary (is_published, level <= barnets niveau)
 *   2. media-URL'er for alle audio_media_id/image_media_id i ét in()-opslag
 *
 * Lyd følger lyd-reglen (2026-07-14): medie-fil vinder ALTID; browser-TTS
 * er kun pladsholder; tavshed er acceptabel fallback (dansk tekst står der).
 *
 * Progress (valgfrit — kun når profileId + lessonId er givet):
 *   saveRoundProgress fra lib/progress (samme som de andre spil).
 *
 * MUREN: kun vocabulary/media/progress berøres. `content` (og dermed
 * aqidah) læses/skrives aldrig fra dette spil.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { preferredAudioId } from "@/lib/voicePref";
import type { AgeSkin, LessonStepParams, Letter, VocabularyWord } from "@/lib/types";
import { canSpeak, createAudioPlayer, speak, stopSpeaking } from "@/lib/audio";
import { saveRoundProgress } from "@/lib/progress";
import {
  SKIN_CONFIG,
  buildDeck,
  isMatch,
  pickRoundWords,
  xpForMatch,
  type PairCard,
} from "./engine";

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Begivenhed som UI'et reagerer visuelt på (lysbro, vip, ryst).
 * `seq` sikrer at samme begivenhedstype to gange i træk stadig trigger.
 */
export type GameEvent =
  | { seq: number; type: "match"; keys: [string, string]; word: VocabularyWord }
  | { seq: number; type: "miss"; keys: [string, string] }
  | null;

export interface UseMatchPairsOptions {
  skin: AgeSkin;
  /** Barnets sprogniveau (1–4) — filtrerer ordforråd */
  level: number;
  /** Tving en bestemt kategori (fx fra lektions-navigationen) */
  category?: VocabularyWord["category"];
  /** Uden disse to kører spillet fint, men gemmer ikke fremskridt */
  profileId?: string;
  lessonId?: string;
  /**
   * Trin-tilstand: par bygges kun af ord hvis startbogstav er lært
   * (lektions-rammen ejer progress-gem og navigation).
   */
  step?: LessonStepParams;
  onRoundComplete?: (earnedXp: number) => void;
}

export function useMatchPairs(options: UseMatchPairsOptions) {
  const { skin, level, category, profileId, lessonId, step, onRoundComplete } = options;
  const cfg = SKIN_CONFIG[skin];

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [deck, setDeck] = useState<PairCard[]>([]);
  const [phase, setPhase] = useState<"playing" | "done">("playing");

  // Kort-tilstand
  const [litKeys, setLitKeys] = useState<Set<string>>(new Set());
  const [openKeys, setOpenKeys] = useState<string[]>([]); // vend-og-find (mid/teen)
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // soft
  const [locked, setLocked] = useState(false);

  // Score
  const [matched, setMatched] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [moves, setMoves] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const [event, setEvent] = useState<GameEvent>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [ttsUnavailable, setTtsUnavailable] = useState(!canSpeak());

  const player = useMemo(() => createAudioPlayer(), []);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Sidst valgte kategori (soft-skin tema-runde) — undgår at gentage den samme kategori to lektioner i træk. */
  const lastCategoryRef = useRef<string | null>(null);
  const dataRef = useRef<{
    letters: Letter[];
    vocabulary: VocabularyWord[];
    audioUrlById: Map<string, string>;
    imageUrlById: Map<string, string>;
  } | null>(null);

  const emit = useCallback((e: Exclude<GameEvent, null>) => {
    setEvent({ ...e, seq: ++seqRef.current });
  }, []);

  // --------------------------------------------------------------------------
  // Hentning + rundeopbygning
  // --------------------------------------------------------------------------

  const startRound = useCallback(() => {
    const data = dataRef.current;
    if (!data) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    let pool = data.vocabulary;
    let pairsWanted: number | undefined;
    let preferLetterIds: Set<string> | undefined;
    if (step) {
      // Kun ord hvis startbogstav er lært: trinnets nye bogstaver +
      // (ved repetition) alt før dem. Barnet møder aldrig uset stof.
      const maxPos = Math.max(...step.letterPositions);
      const allowedIds = new Set(
        data.letters
          .filter((l) =>
            step.includeReview
              ? l.position <= maxPos
              : step.letterPositions.includes(l.position),
          )
          .map((l) => l.id),
      );
      const filtered = data.vocabulary.filter(
        (w) => w.first_letter_id !== null && allowedIds.has(w.first_letter_id),
      );
      // Færre end 2 lærte ord kan ikke danne par — fald tilbage til alt
      // (kan kun ske ved defekt pensum-data; hellere spil end blank skærm).
      if (filtered.length >= 2) pool = filtered;
      pairsWanted = step.questionCount;
      // Lektionens EGNE nye bogstaver (ikke hele repetitions-poolen) —
      // bruges til at foretrække netop-lærte ord frem for kun gamle ord.
      preferLetterIds = new Set(
        data.letters.filter((l) => step.letterPositions.includes(l.position)).map((l) => l.id),
      );
    }
    const { words, chosenCategory } = pickRoundWords(skin, pool, category, pairsWanted, {
      preferLetterIds,
      avoidCategory: lastCategoryRef.current ?? undefined,
    });
    if (chosenCategory) lastCategoryRef.current = chosenCategory;
    setDeck(buildDeck(words));
    setPhase("playing");
    setLitKeys(new Set());
    setOpenKeys([]);
    setSelectedKey(null);
    setLocked(false);
    setMatched(0);
    setCombo(0);
    setBestCombo(0);
    setXp(0);
    setMoves(0);
    setAttempts(0);
    setEvent(null);
    setSaveState("idle");
  }, [skin, category, step]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState({ status: "loading" });

      const vocabRes = await supabase
        .from("vocabulary")
        .select("*")
        .eq("is_published", true)
        .lte("level", level);

      if (cancelled) return;
      if (vocabRes.error || !vocabRes.data || vocabRes.data.length < 2) {
        setLoadState({
          status: "error",
          message:
            vocabRes.error?.message ??
            "For få ord i databasen til at bygge par.",
        });
        return;
      }

      // Stemmevalg (Habibah/Ahmed): foretrukket spor vælges ved hentning
      const vocabulary = (vocabRes.data as VocabularyWord[]).map((w) => ({
        ...w,
        audio_media_id: preferredAudioId(w),
      }));

      // Bogstavpositioner til trin-filtrering (lille, stabil tabel)
      const lettersRes = await supabase
        .from("letters")
        .select("*")
        .order("position");
      if (cancelled) return;
      const letters = (lettersRes.data ?? []) as Letter[];

      // Lyd- og billed-URL'er i ét kald. Filer er frit udskiftelige
      // (human eller AI — lyd-reglen); findes de, vinder de over TTS/emoji.
      const audioIds = vocabulary
        .map((w) => w.audio_media_id)
        .filter((id): id is string => id !== null);
      const imageIds = vocabulary
        .map((w) => w.image_media_id)
        .filter((id): id is string => id !== null);

      const audioUrlById = new Map<string, string>();
      const imageUrlById = new Map<string, string>();
      const allIds = [...new Set([...audioIds, ...imageIds])];
      if (allIds.length > 0) {
        const mediaRes = await supabase
          .from("media")
          .select("id,url")
          .in("id", allIds);
        if (cancelled) return;
        for (const m of mediaRes.data ?? []) {
          const id = m.id as string;
          const url = m.url as string;
          if (audioIds.includes(id)) audioUrlById.set(id, url);
          if (imageIds.includes(id)) imageUrlById.set(id, url);
        }
      }

      dataRef.current = { letters, vocabulary, audioUrlById, imageUrlById };
      setLoadState({ status: "ready" });
    }

    void load();
    return () => {
      cancelled = true;
      player.dispose();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [level, player]);

  // Byg (ny) runde når data er klar eller skind/kategori skifter
  useEffect(() => {
    if (loadState.status === "ready") startRound();
  }, [loadState.status, startRound]);

  // --------------------------------------------------------------------------
  // Lyd (fil → browser-TTS → stilhed; dansk tekst står altid på kortet)
  // --------------------------------------------------------------------------

  const sayCard = useCallback(
    async (card: PairCard, fromUser: boolean) => {
      if (card.side === "ar") {
        const url = card.word.audio_media_id
          ? dataRef.current?.audioUrlById.get(card.word.audio_media_id)
          : null;
        if (url) {
          void player.play(url);
          return;
        }
        if (!ttsUnavailable) {
          const ok = await speak(card.word.word_ar, "ar-SA");
          if (!ok && fromUser) setTtsUnavailable(true);
        }
      } else if (!ttsUnavailable) {
        void speak(card.word.word_da, "da-DK");
      }
    },
    [player, ttsUnavailable],
  );

  // --------------------------------------------------------------------------
  // Match/fejl-afgørelse
  // --------------------------------------------------------------------------

  const resolveMatch = useCallback(
    (a: PairCard, b: PairCard) => {
      setLitKeys((prev) => new Set(prev).add(a.key).add(b.key));
      setOpenKeys([]);
      setMatched((m) => m + 1);
      setCombo((c) => {
        const next = c + 1;
        setBestCombo((best) => Math.max(best, next));
        setXp((v) => v + xpForMatch(skin, next));
        return next;
      });
      emit({ seq: 0, type: "match", keys: [a.key, b.key], word: a.word });
      // Dansk bekræftelse et øjeblik efter det arabiske ord
      timerRef.current = setTimeout(() => {
        if (!ttsUnavailable) void speak(a.word.word_da, "da-DK");
      }, 250);
      setLocked(false);
    },
    [skin, emit, ttsUnavailable],
  );

  const resolveMiss = useCallback(
    (a: PairCard, b: PairCard) => {
      setCombo(0);
      setOpenKeys([]);
      emit({ seq: 0, type: "miss", keys: [a.key, b.key] });
      setLocked(false);
    },
    [emit],
  );

  // Runden er færdig når alle par lyser
  useEffect(() => {
    if (deck.length > 0 && matched * 2 === deck.length && phase === "playing") {
      const t = setTimeout(() => setPhase("done"), 900);
      return () => clearTimeout(t);
    }
  }, [deck.length, matched, phase]);

  // --------------------------------------------------------------------------
  // Spilhandling: tryk på et kort
  // --------------------------------------------------------------------------

  const tapCard = useCallback(
    (card: PairCard) => {
      if (locked || phase !== "playing" || litKeys.has(card.key)) return;

      if (cfg.flip) {
        // Vend-og-find (mid/teen)
        if (openKeys.includes(card.key) || openKeys.length >= 2) return;
        void sayCard(card, true);
        const nextOpen = [...openKeys, card.key];
        setOpenKeys(nextOpen);
        if (nextOpen.length === 2) {
          setLocked(true);
          setMoves((m) => m + 1);
          setAttempts((n) => n + 1);
          const a = deck.find((c) => c.key === nextOpen[0]);
          const b = deck.find((c) => c.key === nextOpen[1]);
          if (!a || !b) {
            setOpenKeys([]);
            setLocked(false);
            return;
          }
          timerRef.current = setTimeout(
            () => (isMatch(a, b) ? resolveMatch(a, b) : resolveMiss(a, b)),
            isMatch(a, b) ? 380 : cfg.missRevealMs,
          );
        }
        return;
      }

      // Soft: alle kort synlige — vælg ét, vælg partneren
      if (selectedKey === card.key) {
        setSelectedKey(null);
        return;
      }
      void sayCard(card, true);
      if (!selectedKey) {
        setSelectedKey(card.key);
        return;
      }
      const first = deck.find((c) => c.key === selectedKey);
      if (!first) {
        setSelectedKey(card.key);
        return;
      }
      if (first.side === card.side) {
        // Samme side → flyt blot valget (ingen fejl-følelse)
        setSelectedKey(card.key);
        return;
      }
      setAttempts((n) => n + 1);
      setSelectedKey(null);
      if (isMatch(first, card)) {
        setLocked(true);
        resolveMatch(first, card);
      } else {
        emit({ seq: 0, type: "miss", keys: [first.key, card.key] });
      }
    },
    [
      locked,
      phase,
      litKeys,
      cfg.flip,
      cfg.missRevealMs,
      openKeys,
      selectedKey,
      deck,
      sayCard,
      resolveMatch,
      resolveMiss,
      emit,
    ],
  );

  // --------------------------------------------------------------------------
  // Progress-gem (kører én gang når runden er færdig)
  // --------------------------------------------------------------------------

  // Trin-tilstand: rammen ejer progress — meld færdig i stedet for at gemme
  const completeReportedRef = useRef(false);
  useEffect(() => {
    if (phase === "playing") completeReportedRef.current = false;
  }, [phase]);
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
    void saveRoundProgress(profileId, lessonId, xp).then(({ ok }) => {
      if (!cancelled) setSaveState(ok ? "saved" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [phase, profileId, lessonId, xp, saveState, step]);

  const stopAllAudio = useCallback(() => {
    player.stop();
    stopSpeaking();
  }, [player]);

  const imageUrlFor = useCallback((word: VocabularyWord): string | null => {
    return word.image_media_id
      ? (dataRef.current?.imageUrlById.get(word.image_media_id) ?? null)
      : null;
  }, []);

  return {
    loadState,
    phase,
    deck,
    cfg,
    litKeys,
    openKeys,
    selectedKey,
    matched,
    totalPairs: deck.length / 2,
    combo,
    bestCombo,
    xp,
    moves,
    attempts,
    event,
    saveState,
    tapCard,
    restart: startRound,
    stopAllAudio,
    imageUrlFor,
  };
}
