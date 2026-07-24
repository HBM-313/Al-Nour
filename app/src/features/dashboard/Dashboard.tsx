/**
 * Dashboard — forældre-oversigt (Leverance D).
 * Portet 1:1 fra ejer-godkendt demo (nour-dashboard-demo.html):
 * børneliste → fremskridt pr. barn / dyre-kode / GDPR-sletning, og
 * "+ Opret barneprofil" der åbner Leverance C-formularen.
 */

import { useState } from "react";
import type { Account, Profile } from "@/lib/types";
import { ANIMAL_POOL, setPin } from "@/features/pin-login";
import { OpretProfil } from "@/features/opret-profil";
import { PIN_MAX, PIN_MIN, ageOf } from "@/features/opret-profil/engine";
import { useLanguage, type Dictionary } from "@/lib/i18n";
import type { ProgressSummary } from "./engine";
import type { LearningSummary } from "./learning";
import { useDashboard } from "./useDashboard";
import "./dashboard.css";

export interface DashboardProps {
  account: Account;
}

export function Dashboard({ account }: DashboardProps) {
  const { state, patch, toggleProgress, confirmAndDelete, onCreated, onPinSaved, activateAccess } =
    useDashboard();
  const { t } = useLanguage();

  if (state.view === "create") {
    return (
      <div className="flex w-full flex-col gap-3">
        <OpretProfil
          account={account}
          onCreated={(p) => {
            onCreated(p);
          }}
        />
        <button
          type="button"
          onClick={() => patch({ view: "list" })}
          className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold"
        >
          {t.dashboard.backToOverview}
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {state.loading && <p className="db-empty py-6 text-center text-sm">{t.dashboard.loadingChildren}</p>}

      {state.error && (
        <p className="db-hint-warn py-3 text-center text-sm" role="alert">
          {state.error}
        </p>
      )}

      {!state.loading && !state.error && state.children.length === 0 && (
        <div className="db-card rounded-(--radius-skin) p-4">
          <p className="db-empty text-center text-sm leading-relaxed">
            {t.dashboard.noChildrenLine1}
            <br />
            {t.dashboard.noChildrenLine2}
          </p>
        </div>
      )}

      {state.children.map((c) => (
        <ChildCard
          key={c.id}
          child={c}
          open={state.openProgressId === c.id}
          summary={state.progress[c.id]}
          learning={state.learning[c.id]}
          activating={state.provisioningId === c.id}
          onToggleProgress={() => void toggleProgress(c)}
          onPin={() => patch({ pinTarget: c })}
          onDelete={() => patch({ confirmDelete: c })}
          onActivateAccess={() => void activateAccess(c)}
          t={t}
        />
      ))}

      <button
        type="button"
        onClick={() => patch({ view: "create" })}
        className="db-btn-gold w-full rounded-2xl py-3.5 text-base font-bold"
      >
        {t.dashboard.createProfileButton}
      </button>

      {state.confirmDelete && (
        <DeleteOverlay
          child={state.confirmDelete}
          deleting={state.deleting}
          onConfirm={() => void confirmAndDelete()}
          onCancel={() => patch({ confirmDelete: null })}
          t={t}
        />
      )}

      {state.pinTarget && (
        <PinOverlay
          child={state.pinTarget}
          onSaved={() => onPinSaved(state.pinTarget as Profile)}
          onCancel={() => patch({ pinTarget: null })}
          t={t}
        />
      )}

      {state.toast && (
        <div className="db-toast" role="status">
          {state.toast}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Barne-kort
// ----------------------------------------------------------------------------

function ChildCard({
  child,
  open,
  summary,
  learning,
  activating,
  onToggleProgress,
  onPin,
  onDelete,
  onActivateAccess,
  t,
}: {
  child: Profile;
  open: boolean;
  summary: ProgressSummary | "loading" | "error" | undefined;
  learning: LearningSummary | "loading" | "error" | undefined;
  activating: boolean;
  onToggleProgress: () => void;
  onPin: () => void;
  onDelete: () => void;
  onActivateAccess: () => void;
  t: Dictionary;
}) {
  return (
    <div className="db-card rounded-(--radius-skin) p-4">
      <div className="flex items-center gap-3">
        <div className="db-avatar flex size-14 shrink-0 items-center justify-center rounded-full text-3xl" aria-hidden>
          {child.avatar || "🌟"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold">{child.display_name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="db-pill rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {t.dashboard.ageSuffix(ageOf(child.birth_year))}
            </span>
            <span
              className={`db-pill rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${child.pin_hash ? "db-pill-gold" : ""}`}
            >
              {child.pin_hash ? t.dashboard.pinSet : t.dashboard.pinNotSet}
            </span>
            <span className="db-pill rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {child.preferred_voice === "female" ? t.dashboard.voiceFemale : t.dashboard.voiceMale}
            </span>
            {child.auth_user_id ? (
              <span className="db-pill db-pill-gold rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                {t.dashboard.ownAccess}
              </span>
            ) : (
              <button
                type="button"
                disabled={activating}
                onClick={onActivateAccess}
                className="db-pill bg-transparent rounded-full px-2.5 py-0.5 text-[11px] font-semibold underline decoration-dotted disabled:opacity-60"
              >
                {activating ? t.dashboard.activating : t.dashboard.activateAccess}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onToggleProgress}
          className={`db-abtn rounded-xl px-1 py-2.5 text-[12.5px] font-semibold ${open ? "db-abtn-on" : ""}`}
        >
          {open ? t.dashboard.toggleProgressHide : t.dashboard.toggleProgressShow}
        </button>
        <button type="button" onClick={onPin} className="db-abtn rounded-xl px-1 py-2.5 text-[12.5px] font-semibold">
          {t.dashboard.pinButton}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="db-abtn db-abtn-danger rounded-xl px-1 py-2.5 text-[12.5px] font-semibold"
        >
          {t.dashboard.deleteButton}
        </button>
      </div>

      {open && (
        <ProgressBox childName={child.display_name} summary={summary} learning={learning} t={t} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Fremskridt
// ----------------------------------------------------------------------------

function ProgressBox({
  childName,
  summary,
  learning,
  t,
}: {
  childName: string;
  summary: ProgressSummary | "loading" | "error" | undefined;
  learning: LearningSummary | "loading" | "error" | undefined;
  t: Dictionary;
}) {
  if (summary === undefined || summary === "loading") {
    return (
      <div className="db-progress mt-3 pt-3">
        <p className="db-empty text-center text-sm">{t.dashboard.loadingProgress}</p>
      </div>
    );
  }
  if (summary === "error") {
    return (
      <div className="db-progress mt-3 pt-3">
        <p className="db-hint-warn text-center text-sm">{t.dashboard.progressFetchError}</p>
      </div>
    );
  }
  if (summary.empty) {
    return (
      <div className="db-progress mt-3 pt-3">
        <p className="db-empty text-center text-sm leading-relaxed">{t.dashboard.notStartedYet(childName)}</p>
      </div>
    );
  }
  return (
    <div className="db-progress mt-3 pt-3">
      <div className="mb-2 flex justify-between gap-1" aria-hidden>
        {summary.lanterns.map((l) => (
          <div key={l.orderIndex} className={`db-lantern flex-1 text-center ${l.state === "done" ? "db-lit" : l.state === "in_progress" ? "db-half" : ""}`}>
            <div className="db-lantern-ic text-[22px]">🏮</div>
            <small className="block text-[10px]">{l.orderIndex}</small>
          </div>
        ))}
      </div>
      {summary.current && (
        <StatRow
          k={t.dashboard.inProgressLabel}
          v={t.dashboard.inProgressValue(summary.current.orderIndex, summary.current.step, summary.current.totalSteps)}
        />
      )}
      <StatRow k={t.dashboard.completedLessonsLabel} v={t.dashboard.completedLessonsValue(summary.completedCount)} />
      <StatRow k={t.dashboard.totalXpLabel} v={t.dashboard.totalXpValue(summary.totalXp)} />
      <StatRow k={t.dashboard.streakLabel} v={t.dashboard.streakValue(summary.streakCount)} />
      <LearningBox childName={childName} learning={learning} t={t} />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Læringstal (D2) — spil-tællere oversat til noget en forælder kan bruge.
// Et vindue ind i barnets lys, ikke et overvågningspanel: ingen
// sammenligning med andre børn, ingen tid, ingen adfærd (§6.7).
// ----------------------------------------------------------------------------

function LearningBox({
  childName,
  learning,
  t,
}: {
  childName: string;
  learning: LearningSummary | "loading" | "error" | undefined;
  t: Dictionary;
}) {
  const [showLetters, setShowLetters] = useState(false);

  if (learning === undefined || learning === "loading" || learning === "error") return null;

  return (
    <div className="db-learn mt-3.5 pt-3.5">
      <div className="db-learn-title mb-2 text-[12px] font-bold uppercase tracking-wide">
        {t.dashboard.learningHeading(childName)}
      </div>

      {learning.empty ? (
        <p className="db-empty px-1 py-1 text-center text-[13px] leading-relaxed">
          {t.dashboard.learningEmpty(childName)}
        </p>
      ) : (
        <>
          <LearnBar
            label={t.dashboard.learningLettersLabel}
            known={learning.letters.known}
            total={learning.letters.total}
            t={t}
          />

          {learning.knownLetters.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowLetters((v) => !v)}
                className="db-learn-toggle mb-2 text-[12px] font-semibold underline decoration-dotted"
              >
                {showLetters ? t.dashboard.learningHideLetters : t.dashboard.learningShowLetters}
              </button>
              {showLetters && (
                <div className="mb-2.5 flex flex-wrap gap-1.5" dir="rtl">
                  {learning.knownLetters.map((l) => (
                    <span
                      key={l}
                      className="db-learn-glyph flex size-9 items-center justify-center rounded-lg text-[19px]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <LearnBar
            label={t.dashboard.learningWordsLabel}
            known={learning.words.known}
            total={learning.words.total}
            t={t}
          />

          {learning.struggles.length > 0 && (
            <div className="db-struggle mt-1 rounded-2xl px-3 py-2.5">
              <div className="db-learn-title mb-1.5 text-[12px] font-bold">
                {t.dashboard.strugglesHeading(childName)}
              </div>
              {learning.struggles.map((s) => (
                <div key={s.glyph + s.text} className="db-struggle-line flex gap-2 text-[13px] leading-relaxed">
                  <span className="db-struggle-glyph w-6 shrink-0 text-center text-[18px]" aria-hidden>
                    {s.glyph}
                  </span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LearnBar({
  label,
  known,
  total,
  t,
}: {
  label: string;
  known: number;
  total: number;
  t: Dictionary;
}) {
  const pct = total > 0 ? Math.round((known / total) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span>{label}</span>
        <b className="db-learn-val font-bold">{t.dashboard.learningCount(known, total)}</b>
      </div>
      <div
        className="db-bar-track h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={known}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
      >
        <div className="db-bar-fill h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between px-0.5 py-1 text-[13px]">
      <span className="db-stat-k">{k}</span>
      <b className="font-semibold">{v}</b>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Slet-overlay (GDPR ét-kliks med bekræftelse)
// ----------------------------------------------------------------------------

function DeleteOverlay({
  child,
  deleting,
  onConfirm,
  onCancel,
  t,
}: {
  child: Profile;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  t: Dictionary;
}) {
  return (
    <div className="db-overlay" role="dialog" aria-modal="true" aria-label={t.dashboard.deleteDialogAriaLabel(child.display_name)}>
      <div className="db-card w-full max-w-sm rounded-(--radius-skin) p-5">
        <h3 className="text-center text-lg font-bold">{t.dashboard.deleteHeading(child.display_name)}</h3>
        <p className="db-ov-text mt-2 text-center text-[13.5px] leading-relaxed">
          {t.dashboard.deleteExplainPrefix}
          <b className="db-hint-warn">{t.dashboard.deleteExplainBold}</b>
          {t.dashboard.deleteExplainMiddle}
          <b className="db-hint-warn">{t.dashboard.deleteExplainBold2}</b>
          {t.dashboard.deleteExplainSuffix}
        </p>
        <p className="db-empty mt-2 text-center text-xs leading-relaxed">{t.dashboard.deleteGdprNote}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" disabled={deleting} onClick={onConfirm} className="db-btn-danger w-full rounded-2xl py-3.5 text-base font-bold">
            {deleting ? t.dashboard.deleting : t.dashboard.deleteConfirmButton(child.display_name)}
          </button>
          <button type="button" disabled={deleting} onClick={onCancel} className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold">
            {t.dashboard.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pin-overlay: sæt/skift dyre-kode (vælg + bekræft, kun via set_child_pin-RPC)
// ----------------------------------------------------------------------------

function PinOverlay({
  child,
  onSaved,
  onCancel,
  t,
}: {
  child: Profile;
  onSaved: () => void;
  onCancel: () => void;
  t: Dictionary;
}) {
  const [phase, setPhase] = useState<"choose" | "confirm">("choose");
  const [seq, setSeq] = useState<string[]>([]);
  const [confirmSeq, setConfirmSeq] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = phase === "choose" ? seq : confirmSeq;
  const done = phase === "confirm" && confirmSeq.length === seq.length;
  const match = done && confirmSeq.every((v, i) => v === seq[i]);
  const mismatch = phase === "confirm" && confirmSeq.some((v, i) => v !== seq[i]);

  const tap = (i: number) => {
    if (phase === "choose" && seq.length < PIN_MAX) setSeq([...seq, String(i)]);
    else if (phase === "confirm" && confirmSeq.length < seq.length)
      setConfirmSeq([...confirmSeq, String(i)]);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await setPin(child.id, seq);
    setSaving(false);
    if (!res.ok) {
      setError(t.dashboard.pinSaveFailed);
      return;
    }
    onSaved();
  };

  return (
    <div className="db-overlay" role="dialog" aria-modal="true" aria-label={t.dashboard.pinDialogAriaLabel(child.display_name)}>
      <div className="db-card w-full max-w-sm rounded-(--radius-skin) p-5">
        <h3 className="text-center text-lg font-bold">
          {child.pin_hash ? t.dashboard.pinHeadingChange : t.dashboard.pinHeadingSet} {t.dashboard.pinHeadingSuffix(child.display_name)}
        </h3>

        <div className="my-3 flex min-h-[50px] justify-center gap-2.5" aria-hidden>
          {Array.from({ length: PIN_MAX }, (_, i) => (
            <div key={i} className={`db-slot flex size-12 items-center justify-center rounded-full text-2xl ${active[i] !== undefined ? "db-slot-fill" : ""}`}>
              {active[i] !== undefined ? ANIMAL_POOL[Number(active[i])] : ""}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {ANIMAL_POOL.map((a, i) => (
            <button
              key={a}
              type="button"
              aria-label={t.dashboard.animalAriaLabel(i + 1)}
              disabled={active.length >= (phase === "choose" ? PIN_MAX : seq.length)}
              onClick={() => tap(i)}
              className="db-animal rounded-xl pb-1 pt-2.5 text-center text-[28px] leading-tight disabled:opacity-35"
            >
              {a}
              <span className="db-stat-k block text-[10px]">{i + 1}</span>
            </button>
          ))}
        </div>

        <p className={`db-hint mt-2.5 text-center text-[13px] ${mismatch || error ? "db-hint-warn" : match ? "db-hint-ok" : ""}`} role="status">
          {error
            ? error
            : phase === "choose"
              ? t.dashboard.pinChooseHint(PIN_MIN, PIN_MAX)
              : mismatch
                ? t.dashboard.pinMismatch
                : match
                  ? t.dashboard.pinMatch
                  : t.dashboard.pinConfirmHint}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {phase === "choose" ? (
            <button
              type="button"
              disabled={seq.length < PIN_MIN}
              onClick={() => {
                setPhase("confirm");
                setConfirmSeq([]);
              }}
              className="db-btn-gold w-full rounded-2xl py-3.5 text-base font-bold"
            >
              {t.dashboard.pinContinueConfirm}
            </button>
          ) : mismatch ? (
            <button type="button" onClick={() => setConfirmSeq([])} className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold">
              {t.dashboard.tryAgain}
            </button>
          ) : (
            <button type="button" disabled={!match || saving} onClick={() => void save()} className="db-btn-gold w-full rounded-2xl py-3.5 text-base font-bold">
              {saving ? t.dashboard.saving : t.dashboard.saveCode}
            </button>
          )}
          <button type="button" disabled={saving} onClick={onCancel} className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold">
            {t.dashboard.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
