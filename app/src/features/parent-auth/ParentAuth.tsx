/**
 * ParentAuth — forælderens e-mail/adgangskode login og oprettelse
 * (plan-samtykke-flow.md, leverance A).
 *
 * Design portet 1:1 fra ejer-godkendt demo (nour-foraelder-auth-demo.html):
 * samme nattehimmel/guld-scene som PinLogin (#0b1330 → #1d2b50, guld #f5b942,
 * cremet tekst #f5eddd) — parent-auth.css. Flow: tabs (log ind/opret) →
 * formular → velkomst, eller "bekræft din e-mail" hvis projektet kræver det.
 *
 * Kalder de RIGTIGE supabase.auth-kald + ensure_parent_account()-RPC'en
 * (se ./engine.ts) — ingen simulering her, i modsætning til demoen.
 *
 * MUREN: rører kun accounts (auth-identitet) — aldrig content/aqidah.
 */

import { useMemo, useState } from "react";
import type { Account } from "@/lib/types";
import { Consent } from "@/features/consent";
import { OpretProfil } from "@/features/opret-profil";
import { useParentAuth, type AuthMode } from "./useParentAuth";
import "./parent-auth.css";

export interface ParentAuthProps {
  onAuthenticated?: (account: Account) => void;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LEN = 8;

export function ParentAuth({ onAuthenticated }: ParentAuthProps) {
  const { mode, phase, errorMessage, account, switchMode, submit, signOut, updateAccount } = useParentAuth({
    onAuthenticated,
  });

  const stars = useMemo(
    () =>
      Array.from({ length: 32 }, () => ({
        left: `${(Math.random() * 100).toFixed(1)}%`,
        top: `${(Math.random() * 70).toFixed(1)}%`,
        size: Math.random() * 1.6 + 0.6,
        delay: `${(Math.random() * 4).toFixed(1)}s`,
      })),
    [],
  );

  return (
    <div className="auth-scene relative mx-auto w-full max-w-md overflow-hidden rounded-(--radius-skin) px-5 py-8 sm:px-8">
      <div className="auth-stars" aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            className="auth-star"
            style={{
              left: s.left,
              top: s.top,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>

      <div className="relative">
        {phase === "checking_session" ? (
          <p className="auth-sub py-10 text-center text-sm">Tjekker login …</p>
        ) : account ? (
          <Welcome account={account} onSignOut={() => void signOut()} onConsentGiven={updateAccount} />
        ) : phase === "needs_confirmation" ? (
          <NeedsConfirmation onBackToLogin={() => switchMode("login")} />
        ) : (
          <AuthForm
            mode={mode}
            phase={phase}
            errorMessage={errorMessage}
            onSwitchMode={switchMode}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Formular — tabs, felter, validering
// ----------------------------------------------------------------------------

function AuthForm({
  mode,
  phase,
  errorMessage,
  onSwitchMode,
  onSubmit,
}: {
  mode: AuthMode;
  phase: "idle" | "loading" | "error";
  errorMessage: string | null;
  onSwitchMode: (mode: AuthMode) => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const isSignup = mode === "signup";
  const loading = phase === "loading";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setLocalError("Indtast en gyldig e-mailadresse.");
      return;
    }
    if (isSignup && password.length < MIN_PASSWORD_LEN) {
      setLocalError(`Adgangskoden skal være mindst ${MIN_PASSWORD_LEN} tegn.`);
      return;
    }
    if (isSignup && password !== confirm) {
      setLocalError("Adgangskoderne er ikke ens.");
      return;
    }
    if (!isSignup && !password) {
      setLocalError("Indtast din adgangskode.");
      return;
    }

    onSubmit(trimmedEmail, password);
  }

  const shownError = localError ?? errorMessage;

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="text-center">
        <h2 className="auth-title text-2xl font-bold">
          {isSignup ? "Opret forælderkonto" : "Velkommen tilbage"}
        </h2>
        <p className="auth-sub mt-1 text-sm">
          {isSignup
            ? "Opret en konto for at tilføje dine børn til Nour-landet."
            : "Log ind for at følge dine børns rejse gennem Nour-landet."}
        </p>
      </div>

      <div className="auth-tabs flex w-full gap-1 rounded-(--radius-skin) p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          onClick={() => onSwitchMode("login")}
          className={`auth-tab flex-1 rounded-(--radius-skin) py-2 text-sm font-semibold ${
            !isSignup ? "auth-tab-active" : ""
          }`}
        >
          Log ind
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          onClick={() => onSwitchMode("signup")}
          className={`auth-tab flex-1 rounded-(--radius-skin) py-2 text-sm font-semibold ${
            isSignup ? "auth-tab-active" : ""
          }`}
        >
          Opret konto
        </button>
      </div>

      <div aria-live="polite" className="w-full">
        {shownError ? <p className="auth-msg-error rounded-(--radius-skin) px-3 py-2.5 text-sm">{shownError}</p> : null}
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pa-email" className="auth-field-label text-xs font-semibold">
            E-mail
          </label>
          <input
            id="pa-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.dk"
            className="auth-input rounded-(--radius-skin) px-3.5 py-2.5 text-sm"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pa-password" className="auth-field-label text-xs font-semibold">
            Adgangskode
          </label>
          <input
            id="pa-password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="auth-input rounded-(--radius-skin) px-3.5 py-2.5 text-sm"
            required
          />
          {isSignup ? <p className="auth-hint text-xs">Mindst {MIN_PASSWORD_LEN} tegn.</p> : null}
        </div>

        {isSignup ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pa-confirm" className="auth-field-label text-xs font-semibold">
              Gentag adgangskode
            </label>
            <input
              id="pa-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="auth-input rounded-(--radius-skin) px-3.5 py-2.5 text-sm"
              required
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="auth-submit mt-1 flex items-center justify-center gap-2 rounded-(--radius-skin) py-3 text-sm font-bold"
        >
          {loading ? <span className="auth-spinner size-3.5" aria-hidden /> : null}
          {loading
            ? isSignup
              ? "Opretter …"
              : "Logger ind …"
            : isSignup
              ? "Opret konto"
              : "Log ind"}
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------
// E-mailbekræftelse afventes
// ----------------------------------------------------------------------------

function NeedsConfirmation({ onBackToLogin }: { onBackToLogin: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="auth-welcome-glow size-14 rounded-full" aria-hidden />
      <h2 className="auth-title text-xl font-bold">Bekræft din e-mail</h2>
      <p className="auth-msg-info rounded-(--radius-skin) px-4 py-3 text-sm">
        Vi har sendt et bekræftelseslink til din e-mail. Klik på linket, og log derefter ind.
      </p>
      <button type="button" onClick={onBackToLogin} className="auth-ghost rounded-(--radius-skin) px-5 py-2.5 text-sm font-semibold">
        Tilbage til login
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Velkomst — kort tilstands-bekræftelse, derefter overtager App'en flowet
// ----------------------------------------------------------------------------

function Welcome({
  account,
  onSignOut,
  onConsentGiven,
}: {
  account: Account;
  onSignOut: () => void;
  onConsentGiven: (account: Account) => void;
}) {
  if (!account.consent_given_at) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <Consent account={account} onConsented={onConsentGiven} />
        <button
          type="button"
          onClick={onSignOut}
          className="auth-ghost rounded-(--radius-skin) px-5 py-2.5 text-sm font-semibold"
        >
          Log ud i stedet
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="auth-welcome-glow size-14 rounded-full" aria-hidden />
      <div>
        <h2 className="auth-title text-xl font-bold">Du er logget ind</h2>
        <p className="auth-sub mt-1 text-sm">{account.email}</p>
      </div>

      <div className="auth-statebox w-full rounded-(--radius-skin) p-4 text-left text-sm">
        <Row k="accounts.email" v={account.email} />
        <Row k="accounts.role" v={<span className="auth-pill rounded-full px-2 py-0.5 text-xs font-bold">{account.role}</span>} />
        <Row k="accounts.id" v={<span className="font-mono text-xs">{account.id}</span>} />
        <Row
          k="consent_given_at"
          v={<span className="font-mono text-xs">{account.consent_given_at}</span>}
        />
        <Row k="consent_version" v={<span className="font-mono text-xs">{account.consent_version}</span>} />
      </div>

      <div className="w-full">
        <OpretProfil account={account} />
      </div>

      <button type="button" onClick={onSignOut} className="auth-ghost rounded-(--radius-skin) px-5 py-2.5 text-sm font-semibold">
        Log ud
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="auth-statebox-row flex items-center justify-between py-1.5">
      <span className="auth-statebox-k">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
