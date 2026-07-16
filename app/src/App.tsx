import { useState } from "react"
import { VocabUnit, ArabicInline } from "@/components/bilingual/BilingualText"
import { SourceVerifiedBadge } from "@/components/SourceVerifiedBadge"
import { ListenFindGame } from "@/features/lyt-og-find/ListenFindGame"
import { TegnBogstavetGame } from "@/features/tegn-bogstavet/TegnBogstavetGame"
import { MatchPairsGame } from "@/features/match-par/MatchPairsGame"
import { WorldMap } from "@/features/verdenskort/WorldMap"
import { LessonScreen } from "@/features/lektion/LessonScreen"
import type { AgeSkin } from "@/lib/types"

/**
 * Foundation demo screen — verifies the Fase 0 frontend building blocks:
 * age skins, per-block RTL/LTR, world colors, the verified badge.
 * Replaced by the real world map in Fase 1.
 */
export default function App() {
  const [skin, setSkin] = useState<AgeSkin>("mid")
  const [showTranslit, setShowTranslit] = useState(true)
  const [playing, setPlaying] = useState<"none" | "lyt" | "tegn" | "match">("none")
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [mapRefresh, setMapRefresh] = useState(0)

  return (
    <div data-age-skin={skin} className="min-h-screen px-6 py-10">
      <main className="mx-auto flex max-w-2xl flex-col gap-10">
        <header className="text-center">
          <h1
            className="text-5xl font-bold text-night"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Nour <ArabicInline register="fusha">نور</ArabicInline>
          </h1>
          <p className="mt-2 text-ink-soft">
            Fundament-demo: aldersskind, tosproget tekst og verdensfarver
          </p>
        </header>

        {/* Age skin switcher */}
        <section className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold text-ink-soft">
            Aldersskind
          </span>
          <div className="flex gap-2">
            {(["soft", "mid", "teen"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSkin(s)}
                className={`rounded-(--radius-skin) px-5 py-2.5 font-semibold transition-colors ${
                  skin === s
                    ? "bg-night text-dawn"
                    : "bg-dawn-deep text-ink"
                }`}
              >
                {s === "soft" ? "3–6" : s === "mid" ? "7–10" : "11–14"}
              </button>
            ))}
          </div>
        </section>

        {/* Bilingual vocab unit */}
        <section className="rounded-(--radius-skin) bg-white p-8 shadow-sm">
          <VocabUnit
            arabic="كِتَاب"
            transliteration="kitāb"
            danish="bog"
            register="everyday"
            showTransliteration={showTranslit}
          />
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowTranslit((v) => !v)}
              className="rounded-(--radius-skin) bg-dawn-deep px-4 py-2 text-sm font-semibold"
            >
              {showTranslit ? "Skjul transskription" : "Vis transskription"}
            </button>
          </div>
        </section>

        {/* Lektioner (Bogstavernes Dal) — spillene er mekanikker, ikke destinationer */}
        <section className="flex flex-col items-center gap-4">
          {activeLessonId ? (
            <LessonScreen
              lessonId={activeLessonId}
              skin={skin}
              level={1}
              showTransliteration={showTranslit}
              onExit={() => {
                setActiveLessonId(null)
                setMapRefresh((n) => n + 1)
              }}
            />
          ) : playing === "none" ? (
            <WorldMap
              key={mapRefresh}
              skin={skin}
              onOpenLesson={setActiveLessonId}
            />
          ) : null}
        </section>

        {/* Frit spil (uden lektions-ramme) */}
        <section className="flex flex-col items-center gap-4">
          {activeLessonId ? null : playing === "lyt" ? (
            <ListenFindGame
              skin={skin}
              level={1}
              showTransliteration={showTranslit}
              onExit={() => setPlaying("none")}
            />
          ) : playing === "tegn" ? (
            <TegnBogstavetGame skin={skin} onExit={() => setPlaying("none")} />
          ) : playing === "match" ? (
            <MatchPairsGame
              skin={skin}
              level={1}
              showTransliteration={showTranslit}
              onExit={() => setPlaying("none")}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <h2 className="text-sm font-semibold text-ink-soft">Frit spil</h2>
              <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setPlaying("lyt")}
                className="rounded-(--radius-skin) bg-valley px-8 py-4 text-lg font-bold text-white transition-transform active:scale-95"
              >
                Prøv Lyt &amp; Find 🔊
              </button>
              <button
                onClick={() => setPlaying("tegn")}
                className="rounded-(--radius-skin) bg-night px-8 py-4 text-lg font-bold text-white transition-transform active:scale-95"
              >
                Prøv Tegn Bogstavet ✍️
              </button>
              <button
                onClick={() => setPlaying("match")}
                className="rounded-(--radius-skin) bg-mountain px-8 py-4 text-lg font-bold text-white transition-transform active:scale-95"
              >
                Prøv Match-par 🏮
              </button>
              </div>
            </div>
          )}
        </section>

        {/* World colors */}
        <section className="grid grid-cols-3 gap-4 text-center text-sm font-semibold text-white">
          <div className="rounded-(--radius-skin) bg-valley p-4">
            Bogstavernes Dal
          </div>
          <div className="rounded-(--radius-skin) bg-mountain p-4">
            Historiernes Bjerge
          </div>
          <div className="rounded-(--radius-skin) bg-garden p-4">
            Hverdagshaven
          </div>
        </section>

        {/* Verified badge */}
        <section className="flex justify-center">
          <SourceVerifiedBadge sourceReference="Eksempel: Bihar al-Anwar, bind 1" />
        </section>
      </main>
    </div>
  )
}
