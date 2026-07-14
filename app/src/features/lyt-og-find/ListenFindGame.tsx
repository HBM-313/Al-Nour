/**
 * Lyt & Find — første af de fire kernespil (lyd → genkendelse).
 * Bogstavernes Dal, AI-tilladt verden. Rører aldrig content/aqidah.
 *
 * Ét spil, tre aldersskind (ændrer HVORDAN, aldrig HVAD):
 *   soft (3–6):  2 kæmpevalg, ingen læsekrav, ingen "forkert"-følelse —
 *                forkerte valg falmer blot, runden ender altid i jubel.
 *   mid (7–10):  4 valg, bogstaver + ord, venlig feedback, XP + streak
 *                gemmes i progress-tabellen.
 *   teen (11–14): bogstav-FORMER (start/midt/slut) med visuelt lignende
 *                distraktorer, stram æstetik, point uden konfetti.
 *
 * Dansk bærer al instruktion; arabisk vises i egne RTL-øer (dir pr. blok).
 */

import { Volume2, Flame, Star, RotateCcw, ArrowRight } from "lucide-react";
import type { AgeSkin } from "@/lib/types";
import { ArabicBlock } from "@/components/bilingual/BilingualText";
import { FORM_LABEL_DA, type Choice, type Question } from "./engine";
import { useListenFind } from "./useListenFind";

export interface ListenFindGameProps {
  skin: AgeSkin;
  /** Barnets sprogniveau (1–4), fra profilen */
  level?: number;
  /** Transskription under arabiske ord — følger profilens indstilling */
  showTransliteration?: boolean;
  /** Gives disse to, gemmes XP/streak i progress; ellers spilles uden gem */
  profileId?: string;
  lessonId?: string;
  /** Tilbage til verdenskortet */
  onExit?: () => void;
}

export function ListenFindGame({
  skin,
  level = 1,
  showTransliteration = true,
  profileId,
  lessonId,
  onExit,
}: ListenFindGameProps) {
  const game = useListenFind({ skin, level, profileId, lessonId });

  if (game.loadState.status === "loading") {
    return (
      <Shell skin={skin}>
        <p className="py-16 text-center text-ink-soft">Henter bogstaver …</p>
      </Shell>
    );
  }

  if (game.loadState.status === "error") {
    return (
      <Shell skin={skin}>
        <div className="py-16 text-center">
          <p className="font-semibold text-danger">Noget gik galt</p>
          <p className="mt-1 text-sm text-ink-soft">
            {game.loadState.message}
          </p>
        </div>
      </Shell>
    );
  }

  if (game.phase === "done") {
    return (
      <Shell skin={skin}>
        <RoundDone
          skin={skin}
          xp={game.xp}
          correctCount={game.correctCount}
          total={game.questions.length}
          saveState={game.saveState}
          savingEnabled={Boolean(profileId && lessonId)}
          onRestart={game.restart}
          onExit={onExit}
        />
      </Shell>
    );
  }

  if (!game.current) return null;

  return (
    <Shell skin={skin}>
      <div className="flex flex-col gap-6">
        <ProgressDots
          skin={skin}
          total={game.questions.length}
          index={game.index}
        />
        <Prompt
          skin={skin}
          question={game.current}
          ttsUnavailable={game.ttsUnavailable}
          onPlay={() => void game.playPrompt(true)}
        />
        <ChoiceGrid
          skin={skin}
          question={game.current}
          answered={game.answered}
          triedChoiceIds={game.triedChoiceIds}
          showTransliteration={showTransliteration}
          onChoose={(id) => game.answer(id)}
        />
        {game.answered ? (
          <AfterAnswer skin={skin} question={game.current} onNext={game.next} />
        ) : null}
      </div>
    </Shell>
  );
}

// ----------------------------------------------------------------------------
// Ramme — Bogstavernes Dals grønne accent, radius/skala fra aldersskindet
// ----------------------------------------------------------------------------

function Shell({ skin, children }: { skin: AgeSkin; children: React.ReactNode }) {
  return (
    <div
      data-age-skin={skin}
      className="mx-auto w-full max-w-xl rounded-(--radius-skin) border-2 p-5 sm:p-7"
      style={{ borderColor: "var(--color-valley)", background: "white" }}
    >
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Fremskridt: lysende prikker (soft/mid) eller diskret bjælke (teen)
// ----------------------------------------------------------------------------

function ProgressDots({
  skin,
  total,
  index,
}: {
  skin: AgeSkin;
  total: number;
  index: number;
}) {
  if (skin === "teen") {
    return (
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-dawn-deep">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(index / total) * 100}%`,
              background: "var(--color-valley)",
            }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-ink-soft">
          {index + 1}/{total}
        </span>
      </div>
    );
  }

  // soft/mid: hvert klaret spørgsmål tænder et lys
  return (
    <div className="flex justify-center gap-2" aria-label={`Spørgsmål ${index + 1} af ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full transition-colors ${
            skin === "soft" ? "size-4" : "size-3"
          }`}
          style={{
            background:
              i < index
                ? "var(--color-nour)"
                : i === index
                  ? "var(--color-nour-soft)"
                  : "var(--color-dawn-deep)",
          }}
        />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Prompt: den store lyd-knap. Lyd-kilde-prioritering (lyd-reglen 2026-07-14):
//   medie-fil (human/AI, frit udskiftelig) → browser-TTS-pladsholder →
//   tekst-fallback. Kun Quran-recitation er human-only (håndhævet i DB);
//   den kan pr. trigger aldrig ende på bogstaver.
// ----------------------------------------------------------------------------

function Prompt({
  skin,
  question,
  ttsUnavailable,
  onPlay,
}: {
  skin: AgeSkin;
  question: Question;
  ttsUnavailable: boolean;
  onPlay: () => void;
}) {
  const usesTts =
    question.audioUrl === null &&
    question.ttsText !== null &&
    !ttsUnavailable;
  const hasAudio = question.audioUrl !== null || usesTts;

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p
        className={`font-semibold text-ink ${
          skin === "soft" ? "text-2xl" : skin === "mid" ? "text-xl" : "text-lg"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {question.instructionDa}
      </p>

      {hasAudio ? (
        <button
          type="button"
          onClick={onPlay}
          aria-label="Hør lyden igen"
          className={`flex items-center justify-center rounded-full text-white shadow-md transition-transform active:scale-95 ${
            skin === "soft" ? "size-28" : skin === "mid" ? "size-20" : "size-16"
          }`}
          style={{ background: "var(--color-valley)" }}
        >
          <Volume2 className={skin === "soft" ? "size-14" : "size-9"} />
        </button>
      ) : null}

      {usesTts && skin !== "soft" ? (
        <p className="text-xs text-ink-soft">
          Syntetisk stemme — udskiftes med rigtig lyd senere
        </p>
      ) : null}

      {!hasAudio ? (
        <div
          className="rounded-(--radius-skin) px-5 py-4"
          style={{ background: "var(--color-dawn-deep)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Lyd ikke optaget endnu
          </p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {question.fallback.titleDa}
          </p>
          {question.fallback.hintDa ? (
            <p className="mt-0.5 text-sm text-ink-soft">
              ({question.fallback.hintDa})
            </p>
          ) : null}
        </div>
      ) : null}

      {question.kind === "letter_form" && question.formPosition ? (
        <p className="text-sm text-ink-soft">
          Formen {FORM_LABEL_DA[question.formPosition]}
        </p>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Valg-kort
// ----------------------------------------------------------------------------

function ChoiceGrid({
  skin,
  question,
  answered,
  triedChoiceIds,
  showTransliteration,
  onChoose,
}: {
  skin: AgeSkin;
  question: Question;
  answered: boolean;
  triedChoiceIds: ReadonlySet<string>;
  showTransliteration: boolean;
  onChoose: (id: string) => void;
}) {
  // 2 valg (soft) og 4 valg (mid/teen) ligger begge i et 2-kolonne-grid:
  // soft får to kæmpekort side om side, mid/teen får 2×2.
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {question.choices.map((c) => (
        <ChoiceCard
          key={c.id}
          skin={skin}
          question={question}
          choice={c}
          answered={answered}
          tried={triedChoiceIds.has(c.id)}
          showTransliteration={showTransliteration}
          onChoose={() => onChoose(c.id)}
        />
      ))}
    </div>
  );
}

function ChoiceCard({
  skin,
  question,
  choice,
  answered,
  tried,
  showTransliteration,
  onChoose,
}: {
  skin: AgeSkin;
  question: Question;
  choice: Choice;
  answered: boolean;
  tried: boolean;
  showTransliteration: boolean;
  onChoose: () => void;
}) {
  // Visuel tilstand:
  //   soft: forkert valg falmer stille ("tried") — aldrig rødt, aldrig "forkert"
  //   mid/teen efter svar: det rigtige fremhæves grønt; barnets forkerte valg
  //   markeres blidt (dawn-deep), ikke aggressivt rødt.
  const isRevealedCorrect = answered && choice.isCorrect;
  const isSoftFaded = tried && skin === "soft";
  const disabled = answered || isSoftFaded;

  const border = isRevealedCorrect
    ? "var(--color-valley)"
    : tried
      ? "var(--color-dawn-deep)"
      : "var(--color-dawn-deep)";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      className={`flex flex-col items-center justify-center gap-1 rounded-(--radius-skin) border-4 bg-white px-3 transition-all active:scale-95 ${
        skin === "soft" ? "min-h-40 py-6" : skin === "mid" ? "min-h-28 py-4" : "min-h-24 py-3"
      } ${isSoftFaded ? "opacity-35" : ""} ${
        answered && !choice.isCorrect ? "opacity-45" : ""
      }`}
      style={{
        borderColor: border,
        background: isRevealedCorrect ? "var(--color-nour-soft)" : "white",
      }}
    >
      <ArabicBlock
        register={question.register}
        className={
          skin === "soft"
            ? "text-7xl leading-none"
            : question.kind === "word"
              ? "text-3xl"
              : "text-5xl leading-none"
        }
      >
        {choice.arabic}
      </ArabicBlock>

      {question.kind === "word" && showTransliteration && choice.transliteration ? (
        <span className="transliteration text-xs">{choice.transliteration}</span>
      ) : null}

      {/* Dansk betydning vises som forstærkning EFTER svar — aldrig som hint */}
      {answered ? (
        <span dir="ltr" lang="da" className="text-sm font-semibold text-ink-soft">
          {choice.danish}
        </span>
      ) : null}
    </button>
  );
}

// ----------------------------------------------------------------------------
// Efter svar: venlig feedback + videre-knap
// ----------------------------------------------------------------------------

function AfterAnswer({
  skin,
  question,
  onNext,
}: {
  skin: AgeSkin;
  question: Question;
  onNext: () => void;
}) {
  const correct = question.choices.find((c) => c.isCorrect);
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center font-semibold text-ink">
        {skin === "soft"
          ? "Flot fundet! ⭐"
          : skin === "mid"
            ? `Det var ${correct?.danish} — ${
                correct ? "flot klaret!" : ""
              }`
            : `Rigtigt svar: ${correct?.danish}`}
      </p>
      <button
        type="button"
        onClick={onNext}
        className="flex items-center gap-2 rounded-(--radius-skin) px-6 py-3 font-bold text-white transition-transform active:scale-95"
        style={{ background: "var(--color-night)" }}
      >
        Videre <ArrowRight className="size-5" />
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Runde færdig — belønning: lys til landet (primær), XP/streak (sekundær)
// ----------------------------------------------------------------------------

function RoundDone({
  skin,
  xp,
  correctCount,
  total,
  saveState,
  savingEnabled,
  onRestart,
  onExit,
}: {
  skin: AgeSkin;
  xp: number;
  correctCount: number;
  total: number;
  saveState: "idle" | "saving" | "saved" | "error";
  savingEnabled: boolean;
  onRestart: () => void;
  onExit?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      {skin !== "teen" ? (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: skin === "soft" ? 3 : Math.max(1, Math.round((correctCount / total) * 3)) }, (_, i) => (
            <Star
              key={i}
              className={skin === "soft" ? "size-12" : "size-9"}
              style={{ color: "var(--color-nour)", fill: "var(--color-nour)" }}
            />
          ))}
        </div>
      ) : null}

      <h2
        className={`font-bold text-night ${skin === "soft" ? "text-3xl" : "text-2xl"}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {skin === "soft"
          ? "Landet fik mere lys!"
          : skin === "mid"
            ? "Godt klaret!"
            : "Runde færdig"}
      </h2>

      {skin !== "soft" ? (
        <div className="flex items-center gap-4 text-ink">
          <span className="font-semibold tabular-nums">
            {correctCount}/{total} rigtige i første forsøg
          </span>
          <span
            className="flex items-center gap-1 rounded-full px-3 py-1 font-bold text-white"
            style={{ background: "var(--color-nour)" }}
          >
            +{xp} XP
          </span>
        </div>
      ) : null}

      {savingEnabled ? (
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          {saveState === "saving" ? (
            "Gemmer fremskridt …"
          ) : saveState === "saved" ? (
            <>
              <Flame className="size-4" style={{ color: "var(--color-nour)" }} />
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
          onClick={onRestart}
          className="flex items-center gap-2 rounded-(--radius-skin) px-6 py-3 font-bold text-white transition-transform active:scale-95"
          style={{ background: "var(--color-valley)" }}
        >
          <RotateCcw className="size-5" /> Spil igen
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
  );
}
