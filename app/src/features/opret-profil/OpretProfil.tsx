/**
 * OpretProfil — opret barneprofil-formular (Leverance C).
 * Portet 1:1 fra ejer-godkendt demo (nour-opret-profil-demo.html).
 *
 * Dataminimering i UI'et: kaldenavn + fødselsår + avatar + stemme +
 * valgfri dyre-pin. Intet andet felt. Synlig privatlivs-note.
 */

import { useId } from "react";
import type { Account, Profile } from "@/lib/types";
import { ANIMAL_POOL } from "@/features/pin-login";
import { ageOf, AVATAR_POOL, birthYearOptions, PIN_MAX, PIN_MIN } from "./engine";
import { useOpretProfil } from "./useOpretProfil";
import "./opret-profil.css";

export interface OpretProfilProps {
  account: Account;
  /** Kaldes når en profil er oprettet (til liste-opdatering i forældre-UI) */
  onCreated?: (profile: Profile) => void;
}

const STEP_ORDER = ["about", "pin", "confirm", "summary"] as const;

export function OpretProfil({ account, onCreated }: OpretProfilProps) {
  const {
    state,
    patch,
    aboutComplete,
    confirmMatch,
    confirmMismatch,
    canConfirmPin,
    tapAnimal,
    create,
    reset,
  } = useOpretProfil(account.id, onCreated);
  const nameId = useId();

  const stepIndex =
    state.step === "saving" || state.step === "done"
      ? STEP_ORDER.length
      : STEP_ORDER.indexOf(state.step as (typeof STEP_ORDER)[number]) + 1;

  return (
    <div className="op-scene relative w-full overflow-hidden rounded-(--radius-skin) p-5">
      <header className="mb-3 text-center">
        <div className="op-lamp text-3xl" aria-hidden>
          🏮
        </div>
        <h2 className="op-title mt-1 text-xl font-bold">Opret barneprofil</h2>
        <p className="op-sub mt-1 text-sm">{subtitleFor(state.step, state.name)}</p>
      </header>

      <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
        {STEP_ORDER.map((s, i) => (
          <span key={s} className={`op-step-dot ${i < stepIndex ? "op-step-on" : ""}`} />
        ))}
      </div>

      {state.step === "about" && (
        <StepAbout
          nameId={nameId}
          name={state.name}
          birthYear={state.birthYear}
          avatar={state.avatar}
          voice={state.voice}
          complete={aboutComplete}
          onPatch={patch}
          onNext={() => patch({ step: "pin", pin: [], pinConfirm: [] })}
        />
      )}

      {state.step === "pin" && (
        <StepPin
          name={state.name}
          pin={state.pin}
          canNext={canConfirmPin}
          onTap={(i) => tapAnimal("pin", i)}
          onClear={() => patch({ pin: [] })}
          onNext={() => patch({ step: "confirm", pinConfirm: [] })}
          onSkip={() => patch({ step: "summary", pin: [], pinConfirm: [] })}
        />
      )}

      {state.step === "confirm" && (
        <StepConfirm
          pinLength={state.pin.length}
          seq={state.pinConfirm}
          match={confirmMatch}
          mismatch={confirmMismatch}
          onTap={(i) => tapAnimal("pinConfirm", i)}
          onRetry={() => patch({ pinConfirm: [] })}
          onNext={() => patch({ step: "summary" })}
          onBack={() => patch({ step: "pin", pin: [], pinConfirm: [] })}
        />
      )}

      {(state.step === "summary" || state.step === "saving") && (
        <StepSummary
          state={state}
          saving={state.step === "saving"}
          onCreate={() => void create()}
          onBack={() => patch({ step: "about", error: null })}
        />
      )}

      {state.step === "done" && state.createdProfile && (
        <StepDone
          profile={state.createdProfile}
          hadPin={state.pin.length >= PIN_MIN}
          pinWarning={state.pinWarning}
          onAgain={reset}
        />
      )}
    </div>
  );
}

function subtitleFor(step: string, name: string): string {
  switch (step) {
    case "about":
      return "Fortæl os lidt om dit barn";
    case "pin":
      return `Dyre-kode til ${name} (valgfrit)`;
    case "confirm":
      return "Vælg de samme dyr igen";
    case "summary":
    case "saving":
      return "Tjek at alt passer";
    default:
      return "";
  }
}

// ----------------------------------------------------------------------------
// Trin 1: Om barnet
// ----------------------------------------------------------------------------

function StepAbout({
  nameId,
  name,
  birthYear,
  avatar,
  voice,
  complete,
  onPatch,
  onNext,
}: {
  nameId: string;
  name: string;
  birthYear: number | null;
  avatar: string | null;
  voice: "female" | "male";
  complete: boolean;
  onPatch: (p: { name?: string; birthYear?: number; avatar?: string; voice?: "female" | "male" }) => void;
  onNext: () => void;
}) {
  const years = birthYearOptions();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={nameId} className="op-label">
        Kaldenavn
      </label>
      <input
        id={nameId}
        type="text"
        maxLength={30}
        autoComplete="off"
        placeholder="fx Ali eller Zainab"
        value={name}
        onChange={(e) => onPatch({ name: e.target.value })}
        className="op-input w-full rounded-xl px-4 py-3.5 text-base"
      />

      <span className="op-label mt-3">Fødselsår</span>
      <div className="grid grid-cols-4 gap-2">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => onPatch({ birthYear: y })}
            className={`op-chip rounded-xl px-1 py-2.5 text-sm font-semibold ${birthYear === y ? "op-sel" : ""}`}
          >
            {y}
            <small className="op-chip-small block text-[11px] font-normal">{ageOf(y)} år</small>
          </button>
        ))}
      </div>

      <span className="op-label mt-3">
        Avatar <b className="op-label-note">· kan skiftes senere</b>
      </span>
      <div className="grid grid-cols-4 gap-2">
        {AVATAR_POOL.map((e, i) => (
          <button
            key={e}
            type="button"
            aria-label={`Avatar ${i + 1}`}
            onClick={() => onPatch({ avatar: e })}
            className={`op-chip rounded-xl py-3 text-3xl leading-none ${avatar === e ? "op-sel" : ""}`}
          >
            {e}
          </button>
        ))}
      </div>

      <span className="op-label mt-3">Oplæser-stemme</span>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPatch({ voice: "female" })}
          className={`op-chip rounded-xl px-2 py-3 text-base font-semibold ${voice === "female" ? "op-sel" : ""}`}
        >
          🎀 Habibah
          <small className="op-chip-small block text-[11px] font-normal">kvindestemme</small>
        </button>
        <button
          type="button"
          onClick={() => onPatch({ voice: "male" })}
          className={`op-chip rounded-xl px-2 py-3 text-base font-semibold ${voice === "male" ? "op-sel" : ""}`}
        >
          🎩 Ahmed
          <small className="op-chip-small block text-[11px] font-normal">mandestemme</small>
        </button>
      </div>

      <div className="op-privacy mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed">
        <span aria-hidden>🔒</span>
        <span>
          Vi gemmer kun kaldenavn, fødselsår og avatar — aldrig fulde navne, adresser eller
          e-mails på børn.
        </span>
      </div>

      <button
        type="button"
        disabled={!complete}
        onClick={onNext}
        className="op-btn-gold mt-3 w-full rounded-2xl py-3.5 text-base font-bold"
      >
        Videre
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Dyre-grid (delt af trin 2 + 3) — samme visuelle kontrakt som pin-login
// ----------------------------------------------------------------------------

function AnimalPicker({
  seq,
  onTap,
}: {
  seq: readonly string[];
  onTap: (poolIndex: number) => void;
}) {
  const full = seq.length >= PIN_MAX;
  return (
    <>
      <div className="mb-3 flex min-h-[52px] justify-center gap-2.5" aria-hidden>
        {Array.from({ length: PIN_MAX }, (_, i) => (
          <div
            key={i}
            className={`op-slot flex size-12 items-center justify-center rounded-full text-2xl ${
              seq[i] !== undefined ? "op-slot-fill" : ""
            }`}
          >
            {seq[i] !== undefined ? ANIMAL_POOL[Number(seq[i])] : ""}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ANIMAL_POOL.map((a, i) => (
          <button
            key={a}
            type="button"
            aria-label={`Dyr ${i + 1}`}
            disabled={full}
            onClick={() => onTap(i)}
            className="op-chip rounded-xl pb-1.5 pt-3 text-center text-[32px] leading-tight disabled:opacity-40"
          >
            {a}
            <span className="op-chip-small block text-[11px]">{i + 1}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Trin 2: Vælg pin (valgfrit)
// ----------------------------------------------------------------------------

function StepPin({
  name,
  pin,
  canNext,
  onTap,
  onClear,
  onNext,
  onSkip,
}: {
  name: string;
  pin: readonly string[];
  canNext: boolean;
  onTap: (i: number) => void;
  onClear: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AnimalPicker seq={pin} onTap={onTap} />
      <p className="op-hint mt-2 text-center text-sm">
        Tryk på {PIN_MIN}–{PIN_MAX} dyr i den rækkefølge, der skal være {name}s kode.
      </p>
      <button
        type="button"
        disabled={pin.length === 0}
        onClick={onClear}
        className="op-btn-ghost mt-1 w-full rounded-2xl py-3 text-sm font-semibold"
      >
        Ryd
      </button>
      <button
        type="button"
        disabled={!canNext}
        onClick={onNext}
        className="op-btn-gold w-full rounded-2xl py-3.5 text-base font-bold"
      >
        Videre — bekræft koden
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="op-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold"
      >
        Spring over — ingen kode nu
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Trin 3: Bekræft pin
// ----------------------------------------------------------------------------

function StepConfirm({
  pinLength,
  seq,
  match,
  mismatch,
  onTap,
  onRetry,
  onNext,
  onBack,
}: {
  pinLength: number;
  seq: readonly string[];
  match: boolean;
  mismatch: boolean;
  onTap: (i: number) => void;
  onRetry: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AnimalPicker seq={seq} onTap={onTap} />
      <p
        className={`op-hint mt-2 text-center text-sm ${mismatch ? "op-hint-warn" : match ? "op-hint-ok" : ""}`}
        role="status"
      >
        {mismatch
          ? "Hov — det var ikke helt de samme dyr. Prøv igen 💛"
          : match
            ? "Perfekt — koden passer! ✨"
            : `Bekræft koden ved at trykke på de samme ${pinLength} dyr i samme rækkefølge.`}
      </p>
      {mismatch && (
        <button
          type="button"
          onClick={onRetry}
          className="op-btn-ghost mt-1 w-full rounded-2xl py-3 text-sm font-semibold"
        >
          Prøv igen
        </button>
      )}
      <button
        type="button"
        disabled={!match}
        onClick={onNext}
        className="op-btn-gold w-full rounded-2xl py-3.5 text-base font-bold"
      >
        Videre
      </button>
      <button
        type="button"
        onClick={onBack}
        className="op-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold"
      >
        Tilbage — vælg ny kode
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Trin 4: Opsummering + opret
// ----------------------------------------------------------------------------

function StepSummary({
  state,
  saving,
  onCreate,
  onBack,
}: {
  state: ReturnType<typeof useOpretProfil>["state"];
  saving: boolean;
  onCreate: () => void;
  onBack: () => void;
}) {
  const hasPin = state.pin.length >= PIN_MIN;
  return (
    <div className="flex flex-col gap-1">
      <SumRow k="Kaldenavn" v={state.name.trim()} />
      <SumRow k="Fødselsår" v={`${state.birthYear} · ${state.birthYear ? ageOf(state.birthYear) : ""} år`} />
      <SumRow k="Avatar" v={<span className="text-2xl leading-none">{state.avatar}</span>} />
      <SumRow k="Stemme" v={state.voice === "female" ? "🎀 Habibah" : "🎩 Ahmed"} />
      <SumRow
        k="Dyre-kode"
        v={hasPin ? state.pin.map((i) => ANIMAL_POOL[Number(i)]).join(" ") : "Ingen (kan tilføjes senere)"}
      />

      {state.error && (
        <p className="op-hint-warn mt-2 text-center text-sm" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={onCreate}
        className="op-btn-gold mt-3 w-full rounded-2xl py-3.5 text-base font-bold"
      >
        {saving ? "Opretter…" : "Opret profil"}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onBack}
        className="op-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold"
      >
        Tilbage og ret
      </button>
    </div>
  );
}

function SumRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="op-sum-row flex items-center justify-between py-2.5 text-sm">
      <span className="op-sum-k">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Succes
// ----------------------------------------------------------------------------

function StepDone({
  profile,
  hadPin,
  pinWarning,
  onAgain,
}: {
  profile: Profile;
  hadPin: boolean;
  pinWarning: string | null;
  onAgain: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="op-halo flex size-24 items-center justify-center rounded-full text-5xl" aria-hidden>
        {profile.avatar}
      </div>
      <h3 className="op-title text-lg font-bold">{profile.display_name}s lanterne er tændt! 🏮</h3>
      <p className="op-sub text-sm leading-relaxed">
        Profilen er oprettet{hadPin && !pinWarning ? " med dyre-kode" : ""}.
        <br />
        {profile.display_name} kan nu logge ind fra børne-skærmen
        {hadPin && !pinWarning ? " med sin kode" : ""}.
      </p>
      {pinWarning && (
        <p className="op-hint-warn text-sm" role="alert">
          {pinWarning}
        </p>
      )}
      <button
        type="button"
        onClick={onAgain}
        className="op-btn-gold mt-2 w-full rounded-2xl py-3.5 text-base font-bold"
      >
        Opret endnu en profil
      </button>
    </div>
  );
}
