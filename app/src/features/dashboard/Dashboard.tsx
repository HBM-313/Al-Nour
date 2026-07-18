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
import type { ProgressSummary } from "./engine";
import { useDashboard } from "./useDashboard";
import "./dashboard.css";

export interface DashboardProps {
  account: Account;
}

export function Dashboard({ account }: DashboardProps) {
  const { state, patch, toggleProgress, confirmAndDelete, onCreated, onPinSaved } =
    useDashboard();

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
          Tilbage til oversigten
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {state.loading && <p className="db-empty py-6 text-center text-sm">Henter børn…</p>}

      {state.error && (
        <p className="db-hint-warn py-3 text-center text-sm" role="alert">
          {state.error}
        </p>
      )}

      {!state.loading && !state.error && state.children.length === 0 && (
        <div className="db-card rounded-(--radius-skin) p-4">
          <p className="db-empty text-center text-sm leading-relaxed">
            Ingen børneprofiler endnu.
            <br />
            Opret den første og tænd en lanterne 🏮
          </p>
        </div>
      )}

      {state.children.map((c) => (
        <ChildCard
          key={c.id}
          child={c}
          open={state.openProgressId === c.id}
          summary={state.progress[c.id]}
          onToggleProgress={() => void toggleProgress(c)}
          onPin={() => patch({ pinTarget: c })}
          onDelete={() => patch({ confirmDelete: c })}
        />
      ))}

      <button
        type="button"
        onClick={() => patch({ view: "create" })}
        className="db-btn-gold w-full rounded-2xl py-3.5 text-base font-bold"
      >
        + Opret barneprofil
      </button>

      {state.confirmDelete && (
        <DeleteOverlay
          child={state.confirmDelete}
          deleting={state.deleting}
          onConfirm={() => void confirmAndDelete()}
          onCancel={() => patch({ confirmDelete: null })}
        />
      )}

      {state.pinTarget && (
        <PinOverlay
          child={state.pinTarget}
          onSaved={() => onPinSaved(state.pinTarget as Profile)}
          onCancel={() => patch({ pinTarget: null })}
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
  onToggleProgress,
  onPin,
  onDelete,
}: {
  child: Profile;
  open: boolean;
  summary: ProgressSummary | "loading" | "error" | undefined;
  onToggleProgress: () => void;
  onPin: () => void;
  onDelete: () => void;
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
              {ageOf(child.birth_year)} år
            </span>
            <span
              className={`db-pill rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${child.pin_hash ? "db-pill-gold" : ""}`}
            >
              {child.pin_hash ? "🔑 kode sat" : "ingen kode"}
            </span>
            <span className="db-pill rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
              {child.preferred_voice === "female" ? "🎀 Habibah" : "🎩 Ahmed"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onToggleProgress}
          className={`db-abtn rounded-xl px-1 py-2.5 text-[12.5px] font-semibold ${open ? "db-abtn-on" : ""}`}
        >
          {open ? "Skjul" : "Fremskridt"}
        </button>
        <button type="button" onClick={onPin} className="db-abtn rounded-xl px-1 py-2.5 text-[12.5px] font-semibold">
          Dyre-kode
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="db-abtn db-abtn-danger rounded-xl px-1 py-2.5 text-[12.5px] font-semibold"
        >
          Slet
        </button>
      </div>

      {open && <ProgressBox childName={child.display_name} summary={summary} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Fremskridt
// ----------------------------------------------------------------------------

function ProgressBox({
  childName,
  summary,
}: {
  childName: string;
  summary: ProgressSummary | "loading" | "error" | undefined;
}) {
  if (summary === undefined || summary === "loading") {
    return <div className="db-progress mt-3 pt-3"><p className="db-empty text-center text-sm">Henter fremskridt…</p></div>;
  }
  if (summary === "error") {
    return (
      <div className="db-progress mt-3 pt-3">
        <p className="db-hint-warn text-center text-sm">Fremskridt kunne ikke hentes. Prøv at folde ud igen.</p>
      </div>
    );
  }
  if (summary.empty) {
    return (
      <div className="db-progress mt-3 pt-3">
        <p className="db-empty text-center text-sm leading-relaxed">
          {childName} er ikke begyndt endnu — rejsen venter i Bogstavernes Dal ✨
        </p>
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
        <StatRow k="I gang med" v={`Lektion ${summary.current.orderIndex} · trin ${summary.current.step}/${summary.current.totalSteps}`} />
      )}
      <StatRow k="Fuldførte lektioner" v={`${summary.completedCount} af 7`} />
      <StatRow k="Lys samlet (XP)" v={`${summary.totalXp} ✨`} />
      <StatRow k="Streak" v={`${summary.bestStreak} dage 🔥`} />
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
}: {
  child: Profile;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="db-overlay" role="dialog" aria-modal="true" aria-label={`Slet ${child.display_name}s profil`}>
      <div className="db-card w-full max-w-sm rounded-(--radius-skin) p-5">
        <h3 className="text-center text-lg font-bold">Slet {child.display_name}s profil?</h3>
        <p className="db-ov-text mt-2 text-center text-[13.5px] leading-relaxed">
          Dette sletter <b className="db-hint-warn">alt permanent</b>: profilen, alt fremskridt, XP og dyre-koden.
          Det kan <b className="db-hint-warn">ikke fortrydes</b>.
        </p>
        <p className="db-empty mt-2 text-center text-xs leading-relaxed">
          Sådan overholder Nour din ret til sletning (GDPR) — ét klik, alt væk.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" disabled={deleting} onClick={onConfirm} className="db-btn-danger w-full rounded-2xl py-3.5 text-base font-bold">
            {deleting ? "Sletter…" : `Ja — slet alt om ${child.display_name}`}
          </button>
          <button type="button" disabled={deleting} onClick={onCancel} className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold">
            Fortryd
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
}: {
  child: Profile;
  onSaved: () => void;
  onCancel: () => void;
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
      setError("Koden kunne ikke gemmes. Tjek forbindelsen og prøv igen.");
      return;
    }
    onSaved();
  };

  return (
    <div className="db-overlay" role="dialog" aria-modal="true" aria-label={`Dyre-kode til ${child.display_name}`}>
      <div className="db-card w-full max-w-sm rounded-(--radius-skin) p-5">
        <h3 className="text-center text-lg font-bold">
          {child.pin_hash ? "Skift" : "Sæt"} {child.display_name}s dyre-kode
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
              aria-label={`Dyr ${i + 1}`}
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
              ? `Tryk på ${PIN_MIN}–${PIN_MAX} dyr i rækkefølge.`
              : mismatch
                ? "Hov — ikke helt de samme dyr. Prøv igen 💛"
                : match
                  ? "Perfekt — koden passer! ✨"
                  : "Bekræft ved at vælge de samme dyr igen."}
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
              Videre — bekræft
            </button>
          ) : mismatch ? (
            <button type="button" onClick={() => setConfirmSeq([])} className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold">
              Prøv igen
            </button>
          ) : (
            <button type="button" disabled={!match || saving} onClick={() => void save()} className="db-btn-gold w-full rounded-2xl py-3.5 text-base font-bold">
              {saving ? "Gemmer…" : "Gem koden"}
            </button>
          )}
          <button type="button" disabled={saving} onClick={onCancel} className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold">
            Fortryd
          </button>
        </div>
      </div>
    </div>
  );
}
