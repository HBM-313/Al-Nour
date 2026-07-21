/**
 * Historiernes Bjerge — barnets side (Fase 2, milepæl 2026-07-21).
 *
 * Portet fra ejer-godkendt demo (historiernes-bjerge-demo-v4.html).
 * Viser KUN udgivne, kilde-verificerede aqidah-fortællinger (engine.ts).
 * Ingen legende figurer, intet spil — kun illustreret fortælling (lys,
 * aldrig skikkelse — kerneviden 2) og en blid "hvad husker du?"-quiz.
 * Quizzen er valgfri pr. fortælling (quiz_da kan være null), fordi
 * historie-værkstedet endnu ikke har et UI til at indtaste den
 * (kommende leverance) — indtil da vises fortællingen uden quiz-sektion.
 */

import { useEffect, useState } from "react";
import type { AgeSkin, Content } from "@/lib/types";
import { bodyForSkin } from "@/lib/types";
import { ageForFetch, fetchStoriesForAge } from "./engine";
import "./historiernes-bjerge.css";

export interface HistorierBjergeScreenProps {
  skin: AgeSkin;
  birthYear?: number;
  onExit: () => void;
}

export function HistorierBjergeScreen({
  skin,
  birthYear,
  onExit,
}: HistorierBjergeScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stories, setStories] = useState<Content[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchStoriesForAge(ageForFetch(skin, birthYear)).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
      } else {
        setStories(res.stories);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skin, birthYear]);

  const selected = stories.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="hb-region" data-age-skin={skin}>
      <div className="mx-auto max-w-[640px] px-4 pt-6 pb-16">
        <p className="text-center font-[family-name:var(--font-display)] text-xs font-semibold uppercase tracking-widest text-[var(--color-mountain)] opacity-80 mb-1">
          Nour-landet · جبال الحكايات
        </p>
        <h1 className="text-center font-[family-name:var(--font-display)] text-[1.5em] font-bold text-[var(--color-dawn)] mb-6">
          Historiernes Bjerge
          <span className="arabic block hb-mountain-soft text-[0.6em] mt-1" dir="rtl">
            جبال الحكايات
          </span>
        </h1>

        {selected ? (
          <StoryView
            story={selected}
            skin={skin}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <StoryList
            loading={loading}
            error={error}
            stories={stories}
            onOpen={setSelectedId}
          />
        )}

        <button
          className="hb-mountain-soft block mx-auto mt-7 font-[family-name:var(--font-display)] font-bold text-sm bg-transparent border-0 cursor-pointer"
          onClick={selected ? () => setSelectedId(null) : onExit}
        >
          ← {selected ? "Til fortællingerne" : "Tilbage til kortet"}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Liste over udgivne fortællinger
// ----------------------------------------------------------------------------

function StoryList({
  loading,
  error,
  stories,
  onOpen,
}: {
  loading: boolean;
  error: string | null;
  stories: Content[];
  onOpen: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="hb-card p-8 text-center text-[var(--color-ink-soft)]">
        Henter fortællinger …
      </div>
    );
  }
  if (error) {
    return (
      <div className="hb-card p-8 text-center text-[var(--color-danger)]">
        {error}
      </div>
    );
  }
  if (stories.length === 0) {
    return (
      <div className="hb-card p-10 text-center">
        <LightScene />
        <p className="hb-empty-icon text-4xl mt-6 mb-3" aria-hidden>
          ✨
        </p>
        <p className="text-[var(--color-ink-soft)] leading-relaxed max-w-[26rem] mx-auto">
          Historiernes Bjerge venter stadig på sin første fortælling. Kom
          snart tilbage — lyset er ved at blive tændt.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {stories.map((s) => (
        <button
          key={s.id}
          className="hb-list-item rounded-2xl p-4 text-left cursor-pointer"
          onClick={() => onOpen(s.id)}
        >
          <span className="block font-[family-name:var(--font-display)] font-bold text-[var(--color-ink)]">
            🌟 {s.title_da}
          </span>
          {s.title_ar && (
            <span
              className="arabic block text-[var(--color-mountain)] text-sm mt-0.5"
              dir="rtl"
            >
              {s.title_ar}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Én fortælling: lys-illustration, kilde-mærke, tekst, quiz
// ----------------------------------------------------------------------------

function StoryView({
  story,
  skin,
}: {
  story: Content;
  skin: AgeSkin;
  onBack: () => void;
}) {
  const bodyText = bodyForSkin(story, skin);

  return (
    <div>
      <LightScene />
      <div className="hb-card p-6">
        <span className="hb-verified-bg inline-flex items-center gap-1.5 text-[var(--color-verified)] font-extrabold text-xs rounded-full px-3 py-1.5 mb-4">
          <CheckIcon /> Kilde-verificeret
        </span>

        <h2 className="font-[family-name:var(--font-display)] font-bold text-[1.2em] text-[var(--color-ink)] mb-1">
          {story.title_da}
        </h2>
        {story.title_ar && (
          <p className="arabic text-[var(--color-mountain)] mb-4" dir="rtl">
            {story.title_ar}
          </p>
        )}
        {story.source_reference && (
          <p className="hb-source text-xs text-[var(--color-ink-soft)] pb-4 mb-4">
            Kilde: {story.source_reference}
          </p>
        )}

        <div className="text-[1.05em] leading-relaxed text-[var(--color-ink)]">
          <p>{bodyText}</p>
        </div>

        {story.quiz_da && story.quiz_da.length > 0 && (
          <Quiz questions={story.quiz_da} skin={skin} />
        )}
      </div>
    </div>
  );
}

function LightScene() {
  return (
    <div className="hb-scene">
      <svg viewBox="0 0 400 225" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <defs>
          <radialGradient id="hbGlow" cx="50%" cy="38%" r="55%">
            <stop offset="0%" stopColor="#fff3d0" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#f0b429" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f0b429" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141c3c" />
            <stop offset="100%" stopColor="#2a3868" />
          </linearGradient>
          <linearGradient id="hbMtn1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b4a86" />
            <stop offset="100%" stopColor="#252f5c" />
          </linearGradient>
          <linearGradient id="hbMtn2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#232c56" />
            <stop offset="100%" stopColor="#161d3e" />
          </linearGradient>
        </defs>
        <rect width="400" height="225" fill="url(#hbSky)" />
        <circle cx="60" cy="35" r="1.4" fill="#fff" opacity="0.7" />
        <circle cx="330" cy="28" r="1.6" fill="#fff" opacity="0.8" />
        <circle cx="270" cy="18" r="1.1" fill="#fff" opacity="0.6" />
        <g className="hb-glow">
          <circle cx="200" cy="85" r="70" fill="url(#hbGlow)" />
          <circle cx="200" cy="85" r="6" fill="#fffdf5" />
        </g>
        <path
          d="M0,180 L50,120 L90,150 L140,100 L180,140 L220,95 L260,145 L300,115 L340,150 L400,125 L400,225 L0,225 Z"
          fill="url(#hbMtn2)"
        />
        <path
          d="M0,225 L0,165 L40,190 L80,140 L130,185 L170,150 L210,195 L250,155 L290,190 L340,160 L400,195 L400,225 Z"
          fill="url(#hbMtn1)"
        />
      </svg>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden>
      <circle cx="10" cy="10" r="10" fill="#2e7d5b" />
      <path
        d="M5.5 10.3l2.7 2.7 6.3-6.3"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ----------------------------------------------------------------------------
// "Hvad husker du?"-quiz
// ----------------------------------------------------------------------------

interface QuizAnswerState {
  pickedIndex: number;
}

function Quiz({
  questions,
  skin,
}: {
  questions: NonNullable<Content["quiz_da"]>;
  skin: AgeSkin;
}) {
  const [answers, setAnswers] = useState<Record<number, QuizAnswerState>>({});

  return (
    <div className="hb-quiz mt-8 pt-6">
      <h3 className="font-[family-name:var(--font-display)] font-bold text-[1.1em] text-[var(--color-ink)] mb-1">
        Hvad husker du?
      </h3>
      <p className="text-sm text-[var(--color-ink-soft)] mb-5">
        {skin === "soft"
          ? "Prøv at trykke — der er ikke noget forkert svar her."
          : "Vælg det du husker fra fortællingen."}
      </p>
      {questions.map((q, qi) => {
        const picked = answers[qi];
        return (
          <div key={qi} className="mb-6">
            <p className="font-bold text-[1em] text-[var(--color-ink)] mb-2.5">
              {q.question_da}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((o, oi) => {
                const isPicked = picked?.pickedIndex === oi;
                const showCorrect = picked && o.correct;
                const showWrong = isPicked && !o.correct;
                const cls = [
                  "hb-quiz-option",
                  "rounded-xl px-4 py-3 text-left font-bold",
                  showCorrect ? "hb-quiz-option-correct" : "",
                  showWrong ? "hb-quiz-option-wrong" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={oi}
                    className={cls}
                    disabled={!!picked}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [qi]: { pickedIndex: oi } }))
                    }
                  >
                    {o.text_da}
                  </button>
                );
              })}
            </div>
            {picked && (
              <p
                className={
                  "mt-2 text-sm font-bold " +
                  (skin === "soft" || questions[qi].options[picked.pickedIndex]?.correct
                    ? "text-[var(--color-verified)]"
                    : "text-[var(--color-mountain)]")
                }
              >
                {skin === "soft"
                  ? "Godt tænkt! ✨"
                  : questions[qi].options[picked.pickedIndex]?.correct
                    ? "Ja, sådan var det! 🌟"
                    : "Tæt på — det rigtige svar er fremhævet ovenfor."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
