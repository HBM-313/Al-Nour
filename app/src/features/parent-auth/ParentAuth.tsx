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
import { forgetDeviceRoster } from "@/lib/childRoster";
import { Consent } from "@/features/consent";
import { Dashboard } from "@/features/dashboard";
import { HistorieVaerksted } from "@/features/historie-vaerksted";
import { VokabVaerksted } from "@/features/vokab-vaerksted";
import { useParentAuth, type AuthMode } from "./useParentAuth";
import "./parent-auth.css";

export interface ParentAuthProps {
  onAuthenticated?: (account: Account) => void;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD_LEN = 8;

export function ParentAuth({ onAuthenticated }: ParentAuthProps) {
  const {
    mode,
    phase,
    errorMessage,
    account,
    justDeleted,
    switchMode,
    submit,
    signOut,
    updateAccount,
    deleteAccount,
    dismissFarewell,
  } = useParentAuth({
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
        ) : justDeleted ? (
          <Farewell onClose={dismissFarewell} />
        ) : account ? (
          <Welcome
            account={account}
            onSignOut={() => void signOut()}
            onConsentGiven={updateAccount}
            onDeleteAccount={deleteAccount}
          />
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
  onDeleteAccount,
}: {
  account: Account;
  onSignOut: () => void;
  onConsentGiven: (account: Account) => void;
  onDeleteAccount: (password: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [portalTab, setPortalTab] = useState<"born" | "vaerksted" | "historier">("born");
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deviceForgotten, setDeviceForgotten] = useState(false);

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

      {erRedaktionel(account.role) && (
        <div className="flex w-full gap-2" role="tablist" aria-label="Portal">
          <PortalTab label="Børn" id="born" current={portalTab} onPick={setPortalTab} />
          {isStaff(account.role) && (
            <PortalTab label="Værkstedet" id="vaerksted" current={portalTab} onPick={setPortalTab} />
          )}
          <PortalTab label="Historier" id="historier" current={portalTab} onPick={setPortalTab} />
        </div>
      )}

      <div className="w-full">
        {portalTab === "vaerksted" && isStaff(account.role) ? (
          <VokabVaerksted />
        ) : portalTab === "historier" && erRedaktionel(account.role) ? (
          <HistorieVaerksted role={account.role} />
        ) : (
          <Dashboard account={account} />
        )}
      </div>

      <button type="button" onClick={onSignOut} className="auth-ghost rounded-(--radius-skin) px-5 py-2.5 text-sm font-semibold">
        Log ud
      </button>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => {
            forgetDeviceRoster();
            setDeviceForgotten(true);
          }}
          className="auth-danger-link text-xs font-semibold"
        >
          Glem denne enhed
        </button>
        <p className="auth-sub text-xs opacity-70">
          {deviceForgotten
            ? "Denne enheds gemte børneliste er glemt."
            : "Rydder børnenes navne/billeder, som er gemt lokalt på denne enhed til hurtigere login."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setShowDeleteAccount(true)}
        className="auth-danger-link text-xs font-semibold"
      >
        Slet min konto
      </button>

      {showDeleteAccount && (
        <DeleteAccountOverlay
          email={account.email}
          onConfirm={onDeleteAccount}
          onCancel={() => setShowDeleteAccount(false)}
        />
      )}
    </div>
  );
}

/**
 * Farvel-skærm efter en vellykket kontosletning (Leverance 1.4). Vises i
 * stedet for at falde direkte tilbage til login-formularen — en rolig
 * bekræftelse på at Art. 17-anmodningen er gennemført, ikke bare et tomt
 * skift af skærm.
 */
function Farewell({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="auth-welcome-glow size-14 rounded-full" aria-hidden />
      <div>
        <h2 className="auth-title text-xl font-bold">Din konto er slettet</h2>
        <p className="auth-sub mt-2 text-sm leading-relaxed">
          Din konto og alt tilhørende data — børneprofiler, fremskridt og lys — er slettet
          permanent. Tak fordi du brugte Nour.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="auth-ghost rounded-(--radius-skin) px-5 py-2.5 text-sm font-semibold"
      >
        Luk
      </button>
    </div>
  );
}

/**
 * To-trins bekræftelse + adgangskode-genindtastning før kontosletning
 * (ejer-beslutning, Leverance 1.4): (1) forklar konsekvenser tydeligt,
 * (2) bekræft identitet med adgangskoden, derefter det endelige,
 * uigenkaldelige kald. Genbruger db-*-klasserne fra dashboard.css (allerede
 * indlæst, da Dashboard altid importeres i denne fil) for visuel konsistens
 * med den øvrige sletnings-UI (barneprofil-sletningen).
 */
function DeleteAccountOverlay({
  email,
  onConfirm,
  onCancel,
}: {
  email: string;
  onConfirm: (password: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"explain" | "password">("explain");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async () => {
    setError(null);
    setDeleting(true);
    const res = await onConfirm(password);
    setDeleting(false);
    if (!res.ok) {
      setError(res.error ?? "Sletning fejlede. Prøv igen.");
      return;
    }
    // Ved succes forsvinder denne overlay af sig selv, fordi account bliver
    // null og ParentAuth skifter til Farewell-skærmen.
  };

  return (
    <div className="db-overlay" role="dialog" aria-modal="true" aria-label="Slet din konto">
      <div className="db-card w-full max-w-sm rounded-(--radius-skin) p-5">
        {phase === "explain" ? (
          <>
            <h3 className="text-center text-lg font-bold">Slet din konto?</h3>
            <p className="db-ov-text mt-2 text-center text-[13.5px] leading-relaxed">
              Dette sletter <b className="db-hint-warn">alt permanent</b>: din konto ({email}),
              alle dine børns profiler, alt deres fremskridt og lys, og alle dyre-koder.
            </p>
            <p className="db-empty mt-2 text-center text-xs leading-relaxed">
              Det kan <b className="db-hint-warn">ikke fortrydes</b> — der er ingen
              fortrydelsesperiode. Sletningen sker med det samme.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPhase("password")}
                className="db-btn-danger w-full rounded-2xl py-3.5 text-base font-bold"
              >
                Ja, jeg forstår — fortsæt
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold"
              >
                Fortryd
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-center text-lg font-bold">Bekræft med din adgangskode</h3>
            <p className="db-ov-text mt-2 text-center text-[13.5px] leading-relaxed">
              Indtast din adgangskode for at slette kontoen for altid.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Adgangskode"
              value={password}
              disabled={deleting}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !deleting) void submit();
              }}
              className="auth-input mt-3 w-full rounded-(--radius-skin) px-4 py-3 text-sm"
            />
            {error && (
              <p className="db-hint-warn mt-2 text-center text-xs" role="alert">
                {error}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={!password || deleting}
                onClick={() => void submit()}
                className="db-btn-danger w-full rounded-2xl py-3.5 text-base font-bold"
              >
                {deleting ? "Sletter…" : "Slet min konto for altid"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={onCancel}
                className="db-btn-ghost w-full rounded-2xl py-3 text-sm font-semibold"
              >
                Fortryd
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Ordforråds-værkstedet er kurrikulum-redigering — kun for admin/editor.
 * UI'et skjuler blot fanen; selve adgangen håndhæves af RLS
 * (`vocabulary_write_admin_editor`), aldrig af klienten.
 */
function isStaff(role: Account["role"]): boolean {
  return role === "admin" || role === "editor";
}

/**
 * Historie-værkstedet (aqidah) vises for admin/editor/approver — bredere end
 * `isStaff`, fordi en godkender skal kunne se og verificere/udgive
 * fortællinger uden nødvendigvis at have adgang til Ordforråds-værkstedet.
 * UI'et skjuler blot fanen; adgangen håndhæves af RLS + triggerens Lag D
 * (`content_editor_write_aqidah_draft`, `content_approver_update_aqidah`),
 * aldrig af klienten.
 */
function erRedaktionel(role: Account["role"]): boolean {
  return role === "admin" || role === "editor" || role === "approver";
}

function PortalTab({
  label,
  id,
  current,
  onPick,
}: {
  label: string;
  id: "born" | "vaerksted" | "historier";
  current: "born" | "vaerksted" | "historier";
  onPick: (t: "born" | "vaerksted" | "historier") => void;
}) {
  const selected = current === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onPick(id)}
      className={`auth-ghost flex-1 rounded-(--radius-skin) py-2.5 text-sm font-bold ${selected ? "auth-portal-tab-on" : ""}`}
    >
      {label}
    </button>
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
