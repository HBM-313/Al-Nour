/**
 * WorldMap — "Landet der vågner": Nour-landets navigation (ejer-godkendt
 * demo, portet med sti-fixet done >= n).
 *
 * Kortets lanterner er LEKTIONER (7 à 4 bogstaver i hija'i-orden) — ikke
 * spil; spillene er mekanikker inde i lektionerne. Lys-semantik:
 *   - Sti-segment n tændes I SAMME ØJEBLIK lektion n fuldføres (lyset
 *     strømmer UD fra den tændte lanterne mod den næste).
 *   - Delvist gennemførte lektioner viser en fremskridts-ring.
 *   - Nouri (lysgnisten — ren fantasi af lys, jf. kerneviden 2) svæver ved
 *     den ANBEFALEDE lektion: første ikke-fuldførte. Frit valg, ingen
 *     låsning (ejer-beslutning) — alle lanterner kan altid åbnes.
 *   - Landet bliver varmere jo flere trin der er tændt; ildfluer vågner.
 *   - Historiernes Bjerge og Hverdagshaven ses i horisonten men sover
 *     (fase 2). Bjergene bærer kun lys på toppen — aldrig skikkelser.
 *
 * Progress-kilde: databasen med profileId, ellers anonymt lokal-gem.
 *
 * MUREN: læser lessons/lesson_steps/progress. Aldrig content/aqidah.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllLocalProgress } from "@/lib/localProgress";
import { useT } from "@/lib/i18n";
import {
  stepsForSkin,
  type AgeSkin,
  type Lesson,
  type LessonStep,
} from "@/lib/types";
import "./verdenskort.css";

export interface WorldMapProps {
  skin: AgeSkin;
  /** Uden denne læses anonymt lokal-fremskridt (gæste-tilstand) */
  profileId?: string;
  onOpenLesson: (lessonId: string) => void;
  /**
   * Åbn Historiernes Bjerge (den nye barnets-side-feature). Når denne er
   * wired, regnes regionen for "vågen" i UI'et. WorldMap selv læser ALDRIG
   * content/aqidah (se header-kommentaren) — det er features/historiernes-
   * bjerge/engine.ts der afgør, om der reelt findes udgivne fortællinger,
   * og viser en venlig tom-tilstand hvis ikke.
   */
  onOpenHistorier?: () => void;
}

interface NodeState {
  lesson: Lesson;
  totalSteps: number;
  litSteps: number;
  completed: boolean;
}

/** Lanterne-positioner: snoet sti gennem dalen, mod bjergene (viewBox 700×500) */
const NODE_POS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 85, y: 425 },
  { x: 195, y: 378 },
  { x: 310, y: 408 },
  { x: 425, y: 366 },
  { x: 330, y: 314 },
  { x: 205, y: 282 },
  { x: 330, y: 232 },
];

function pathBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  // Blød kvadratisk bue der løfter sig let mellem to lanterner
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - 26;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

const NODE_R: Record<AgeSkin, number> = { soft: 26, mid: 22, teen: 19 };

export function WorldMap({
  skin,
  profileId,
  onOpenLesson,
  onOpenHistorier,
}: WorldMapProps) {
  const [nodes, setNodes] = useState<NodeState[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT("da");

  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        cx: Math.random() * 700,
        cy: Math.random() * 180,
        r: Math.random() * 1.4 + 0.6,
        o: (Math.random() * 0.55 + 0.2).toFixed(2),
        delay: `${(Math.random() * 4).toFixed(1)}s`,
      })),
    [],
  );
  const flies = useMemo(
    () =>
      Array.from({ length: 14 }, () => ({
        cx: 80 + Math.random() * 400,
        cy: 300 + Math.random() * 130,
        delay: `${(Math.random() * 5).toFixed(1)}s`,
      })),
    [],
  );

  // --------------------------------------------------------------------------
  // Hentning: lektioner + trin + fremskridt
  // --------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [lessonsRes, stepsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("*")
          .eq("world", "bogstavernes_dal")
          .eq("is_published", true)
          .gte("order_index", 1)
          .lte("order_index", 7)
          .order("order_index"),
        supabase.from("lesson_steps").select("*").order("order_index"),
      ]);
      if (cancelled) return;
      if (lessonsRes.error || !lessonsRes.data?.length) {
        setError(lessonsRes.error?.message ?? t.worldMap.noLessonsFound);
        return;
      }
      const lessons = lessonsRes.data as Lesson[];
      const allSteps = (stepsRes.data ?? []) as LessonStep[];

      // Fremskridt: database (profil) eller lokal-gem (gæst)
      const litByLesson = new Map<
        string,
        { lit: number; completed: boolean }
      >();
      if (profileId) {
        const prog = await supabase
          .from("progress")
          .select("lesson_id, current_step, status")
          .eq("profile_id", profileId);
        if (cancelled) return;
        for (const p of prog.data ?? []) {
          litByLesson.set(p.lesson_id as string, {
            lit: (p.current_step as number) ?? 0,
            completed: p.status === "completed",
          });
        }
      } else {
        for (const [lessonId, p] of Object.entries(
          getAllLocalProgress(skin),
        )) {
          litByLesson.set(lessonId, {
            lit: p.current_step,
            completed: p.completed,
          });
        }
      }

      setNodes(
        lessons.map((lesson) => {
          const totalSteps = stepsForSkin(
            allSteps.filter((s) => s.lesson_id === lesson.id),
            skin,
          ).length;
          const p = litByLesson.get(lesson.id);
          const completed = p?.completed ?? false;
          return {
            lesson,
            totalSteps,
            completed,
            litSteps: completed ? totalSteps : Math.min(p?.lit ?? 0, totalSteps),
          };
        }),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [profileId, skin, t]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  // --------------------------------------------------------------------------
  // Afledt lys-tilstand
  // --------------------------------------------------------------------------

  const completedCount = nodes?.filter((n) => n.completed).length ?? 0;
  const recommendedIndex = nodes?.findIndex((n) => !n.completed) ?? 0;
  const recIdx = recommendedIndex === -1 ? 6 : recommendedIndex;
  const totalStepsAll = nodes?.reduce((s, n) => s + n.totalSteps, 0) ?? 0;
  const litStepsAll = nodes?.reduce((s, n) => s + n.litSteps, 0) ?? 0;
  const lightRatio = totalStepsAll > 0 ? litStepsAll / totalStepsAll : 0;
  const allDone = nodes !== null && completedCount === nodes.length;
  const totalXpLocal = useMemo(() => {
    if (profileId || !nodes) return null;
    const all = getAllLocalProgress(skin);
    return Object.values(all).reduce((s, p) => s + p.xp, 0);
  }, [profileId, nodes, skin]);

  const r = NODE_R[skin];

  return (
    <div
      data-age-skin={skin}
      className="relative mx-auto w-full max-w-xl overflow-hidden rounded-(--radius-skin)"
      style={{ background: "#0b1526", isolation: "isolate" }}
    >
      {/* Varmt lys der vokser med landets fremskridt */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "linear-gradient(180deg, rgba(90,60,20,0) 0%, rgba(120,80,25,0.9) 100%)",
          opacity: lightRatio * 0.45,
        }}
      />

      <div className="relative p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            className="me-auto text-lg font-bold"
            style={{ color: "#f4ecd8", fontFamily: "var(--font-display)" }}
          >
            Nour-landet{" "}
            <span
              dir="rtl"
              lang="ar"
              className="arabic text-base"
              style={{ color: "#e8c877" }}
            >
              بِلَاد النُّور
            </span>
          </h2>
          {skin !== "soft" && totalXpLocal !== null && totalXpLocal > 0 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.08)", color: "#ffe3a1" }}
            >
              ★ {totalXpLocal} XP
            </span>
          )}
        </div>
        <div
          className="mt-2 flex items-center gap-3 text-xs sm:text-sm"
          style={{ color: "#b9c6da" }}
        >
          <span className="shrink-0 font-semibold" style={{ color: "#ffe3a1" }}>
            {t.worldMap.lightInTheLand}
          </span>
          <div
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}
            role="progressbar"
            aria-valuenow={Math.round(lightRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.worldMap.lightInTheLand}
          >
            <span
              className="block h-full rounded-full transition-all duration-700"
              style={{
                width: `${lightRatio * 100}%`,
                background: "var(--color-nour)",
                boxShadow: "0 0 10px 2px rgba(240,180,41,0.7)",
              }}
            />
          </div>
          {skin === "teen" && (
            <span className="shrink-0">
              {Math.round(lightRatio * 100)}%
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="p-8 text-center text-sm" style={{ color: "#f09595" }}>
          {error}
        </p>
      )}
      {!error && !nodes && (
        <p className="p-8 text-center text-sm" style={{ color: "#b9c6da" }}>
          {t.worldMap.waking}
        </p>
      )}

      {nodes && (
        <svg
          viewBox="0 0 700 500"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={t.worldMap.mapAriaLabel}
          className="relative block w-full"
        >
          <defs>
            <radialGradient id="vk-glow">
              <stop offset="0" stopColor="#ffd98a" stopOpacity="0.9" />
              <stop offset="0.55" stopColor="#f0b429" stopOpacity="0.35" />
              <stop offset="1" stopColor="#f0b429" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="vk-orbg">
              <stop offset="0" stopColor="#fff6d8" />
              <stop offset="0.55" stopColor="#f0b429" />
              <stop offset="1" stopColor="#f0b429" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="vk-peakg">
              <stop offset="0" stopColor="#cabdf5" stopOpacity="0.8" />
              <stop offset="1" stopColor="#cabdf5" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Stjerner + måne */}
          <g aria-hidden="true">
            {stars.map((s, i) => (
              <circle
                key={i}
                className="vk-star"
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill="#cfe3ff"
                style={
                  {
                    "--vk-o": s.o,
                    animationDelay: s.delay,
                  } as React.CSSProperties
                }
              />
            ))}
            <circle cx="600" cy="58" r="21" fill="#f4ecd8" opacity="0.9" />
            <circle cx="609" cy="52" r="19" fill="#0e1a30" />
            <g className="vk-cloud" opacity="0.13">
              <ellipse cx="120" cy="105" rx="52" ry="12" fill="#cfe3ff" />
              <ellipse cx="160" cy="97" rx="34" ry="9" fill="#cfe3ff" />
            </g>
            <g className="vk-cloud vk-c2" opacity="0.09">
              <ellipse cx="40" cy="148" rx="44" ry="10" fill="#cfe3ff" />
            </g>
          </g>

          {/* Historiernes Bjerge — vågner så snart onOpenHistorier er wired
              fra AppShell. Kun lys på toppen; aldrig skikkelser. Selve
              features/historiernes-bjerge/ afgør (og viser tom-tilstand for),
              om der reelt findes udgivne fortællinger endnu. */}
          <g
            className="vk-node"
            role="button"
            tabIndex={0}
            aria-label={
              onOpenHistorier
                ? t.worldMap.mountainsAriaOpen
                : t.worldMap.mountainsAriaSleeping
            }
            onClick={() =>
              onOpenHistorier
                ? onOpenHistorier()
                : showToast(t.worldMap.mountainsToast)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (onOpenHistorier) {
                  onOpenHistorier();
                } else {
                  showToast(t.worldMap.mountainsToast);
                }
              }
            }}
          >
            <polygon
              points="330,262 420,120 480,200 540,92 610,190 660,140 700,210 700,262"
              fill="#241f3e"
            />
            <polygon
              points="360,262 440,170 500,230 560,150 630,240 700,262"
              fill="#2e2a4e"
            />
            <ellipse
              className="vk-peak"
              cx="540"
              cy="88"
              rx="34"
              ry="22"
              fill="url(#vk-peakg)"
            />
            <ellipse
              cx="540"
              cy="150"
              rx="120"
              ry="70"
              fill="url(#vk-glow)"
              opacity={onOpenHistorier || allDone ? 0.5 : 0}
              style={{ transition: "opacity 1.6s ease" }}
            />
            <text
              x="565"
              y="250"
              textAnchor="middle"
              fill="#8f86c4"
              fontSize="12"
              fontWeight="500"
            >
              Historiernes Bjerge
            </text>
          </g>

          {/* Hverdagshaven (sover — fase 2) */}
          <g
            className="vk-node"
            role="button"
            tabIndex={0}
            aria-label={t.worldMap.gardenAriaSleeping}
            onClick={() => showToast(t.worldMap.gardenToast)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                showToast(t.worldMap.gardenToast);
              }
            }}
          >
            <ellipse cx="645" cy="470" rx="175" ry="115" fill="#3c2a30" />
            <ellipse
              cx="645"
              cy="430"
              rx="115"
              ry="65"
              fill="url(#vk-glow)"
              opacity={allDone ? 0.5 : 0}
              style={{ transition: "opacity 1.6s ease" }}
            />
            <g fill="#7a5560">
              <circle cx="606" cy="402" r="4" />
              <circle cx="646" cy="386" r="4" />
              <circle cx="676" cy="408" r="4" />
            </g>
            <text
              x="638"
              y="448"
              textAnchor="middle"
              fill="#c99"
              fontSize="12"
              fontWeight="500"
            >
              Hverdagshaven
            </text>
          </g>

          {/* Dalen */}
          <ellipse cx="150" cy="530" rx="300" ry="180" fill="#152b1d" />
          <ellipse cx="420" cy="575" rx="350" ry="195" fill="#1b3a26" />
          <text
            x="88"
            y="478"
            fill="#7fbf95"
            fontSize="12.5"
            fontWeight="500"
          >
            Bogstavernes Dal
          </text>

          {/* Ildfluer — vågner med lyset */}
          <g aria-hidden="true">
            {flies.map((f, i) => (
              <circle
                key={i}
                className="vk-fly"
                cx={f.cx}
                cy={f.cy}
                r="2"
                fill="#ffe9a8"
                style={{
                  animationDelay: f.delay,
                  opacity: i < completedCount * 2 ? 1 : 0,
                }}
              />
            ))}
          </g>

          {/* Stien: dæmpet grund + lys der strømmer (done >= n) */}
          {NODE_POS.slice(0, nodes.length - 1).map((p, i) => (
            <g key={i} aria-hidden="true">
              <path
                d={pathBetween(p, NODE_POS[i + 1])}
                fill="none"
                stroke="#3d4d6b"
                strokeWidth="3"
                strokeDasharray="2 9"
                strokeLinecap="round"
              />
              <path
                className="vk-lit-path"
                d={pathBetween(p, NODE_POS[i + 1])}
                fill="none"
                stroke="#ffd98a"
                strokeWidth="3.5"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={completedCount >= i + 1 ? 0 : 1}
                opacity="0.95"
              />
            </g>
          ))}
          {/* Den videre vej mod bjergene — antydet */}
          <path
            d={pathBetween(NODE_POS[6], { x: 520, y: 165 })}
            fill="none"
            stroke="#3d4d6b"
            strokeWidth="2.5"
            strokeDasharray="2 11"
            strokeLinecap="round"
            opacity="0.4"
            aria-hidden="true"
          />

          {/* Lanterner (lektioner) */}
          {nodes.map((n, i) => {
            const pos = NODE_POS[i];
            const started = !n.completed && n.litSteps > 0;
            const ringLen = 2 * Math.PI * (r + 5);
            const frac = n.totalSteps > 0 ? n.litSteps / n.totalSteps : 0;
            return (
              <g
                key={n.lesson.id}
                className={`vk-node ${n.completed ? "vk-done" : ""} ${
                  started ? "vk-started" : ""
                } ${i === recIdx && !allDone ? "vk-rec" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${t.worldMap.lessonLabel(n.lesson.order_index, n.lesson.title_da)}${
                  n.completed
                    ? t.worldMap.lessonDoneSuffix
                    : started
                      ? t.worldMap.lessonStartedSuffix(n.litSteps, n.totalSteps)
                      : ""
                }`}
                onClick={() => onOpenLesson(n.lesson.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenLesson(n.lesson.id);
                  }
                }}
              >
                <circle
                  className="vk-halo"
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 15}
                  fill="url(#vk-glow)"
                />
                <circle
                  className="vk-pulse"
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 3}
                  fill="none"
                  stroke="#ffd98a"
                  strokeWidth="2.5"
                />
                {/* Fremskridts-ring for påbegyndte lektioner */}
                {started && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 5}
                    fill="none"
                    stroke="#f0b429"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${ringLen * frac} ${ringLen}`}
                    transform={`rotate(-90 ${pos.x} ${pos.y})`}
                    opacity="0.9"
                  />
                )}
                <circle
                  className="vk-disc"
                  cx={pos.x}
                  cy={pos.y}
                  r={r}
                  fill={n.completed ? "#2c2410" : "#16243c"}
                  stroke={
                    n.completed
                      ? "#f0b429"
                      : i === recIdx
                        ? "#ffd98a"
                        : "rgba(154,178,214,0.3)"
                  }
                  strokeWidth="2"
                  opacity={n.completed || started || i === recIdx ? 1 : 0.6}
                />
                <text
                  x={pos.x}
                  y={pos.y + 6}
                  textAnchor="middle"
                  fontSize={r * 0.78}
                  fontWeight="700"
                  fill={n.completed ? "#ffe9b8" : "#dbe4f2"}
                >
                  {n.lesson.order_index}
                </text>
                {skin !== "teen" && n.lesson.title_ar && (
                  <text
                    x={pos.x}
                    y={pos.y + r + 20}
                    textAnchor="middle"
                    fontSize="14"
                    fill={n.completed ? "#e8c877" : "#8fa4c4"}
                    direction="rtl"
                  >
                    {n.lesson.title_ar}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nouri — lysgnisten ved den anbefalede lanterne */}
          {!allDone && (
            <g
              className="vk-orb"
              aria-hidden="true"
              transform={`translate(${NODE_POS[recIdx].x + r + 12} ${
                NODE_POS[recIdx].y - r - 8
              })`}
            >
              <circle className="vk-orbcore" r="10" fill="url(#vk-orbg)" />
            </g>
          )}
        </svg>
      )}

      {/* Toast */}
      <div
        aria-live="polite"
        className="vk-toast pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1.5 text-sm whitespace-nowrap"
        style={{
          background: "rgba(12,20,36,0.92)",
          color: "#ffe9b8",
          borderColor: "rgba(240,180,41,0.4)",
          opacity: toast ? 1 : 0,
          transform: `translateX(-50%) translateY(${toast ? 0 : 8}px)`,
        }}
      >
        {toast ?? ""}
      </div>

      {allDone && (
        <p
          className="relative pb-4 text-center text-sm font-semibold"
          style={{ color: "#ffe3a1" }}
        >
          {t.worldMap.allDoneText}
        </p>
      )}
    </div>
  );
}
