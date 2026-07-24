/**
 * AppShell — appens rigtige indgang (ejer-godkendt demo
 * nour-app-skal-demo.html, portet 1:1: nattehimmel #0b1330, guld #f5b942).
 *
 * Samler de allerede godkendte features i ét flow:
 *   landing → ParentAuth (login → samtykke → dashboard)
 *           → PinLogin (profilvælger → dyre-pin) → lukket børne-tilstand
 *           → gæste-sti ("prøv uden konto") med "gem dit lys"-opfordring
 *
 * Børnesikkerhed: børne-tilstanden er lukket — eneste udgang er "Skift
 * bruger" (tilbage til profilvælgeren); ingen eksterne links, ingen køb.
 * Forældre-området nås fra børne-indgangen KUN gennem adgangskode-porten.
 *
 * MUREN: skallen rører kun profiles/progress og Supabase Auth — aldrig
 * content/aqidah.
 */

import { useMemo, useState } from "react";
import { ParentAuth } from "@/features/parent-auth";
import {
  PinLogin,
  type ChildSigninCredentials,
  type PinLoginProfile,
} from "@/features/pin-login";
import { WorldMap } from "@/features/verdenskort/WorldMap";
import { LessonScreen } from "@/features/lektion/LessonScreen";
import { HistorierBjergeScreen } from "@/features/historiernes-bjerge";
import { ageSkinForBirthYear, type AgeSkin, type Profile } from "@/lib/types";
import { useT, type Dictionary, LanguageProvider } from "@/lib/i18n";
import { useAppShell } from "./useAppShell";
import "./app-shell.css";

function voiceLabel(pref: string | null | undefined, t: Dictionary): string {
  return pref === "male" ? t.appShell.voiceLabelMale : t.appShell.voiceLabelFemale;
}

export function AppShell() {
  const shell = useAppShell();
  const t = useT("da");

  return (
    <div className="shell-scene">
      <ShellStars />
      <div className="shell-app">
        {shell.view === "loading" && (
          <p className="shell-hint shell-center">{t.appShell.loadingLanterns}</p>
        )}

        {shell.view === "landing" && (
          <Landing
            onParent={() => shell.goTo("parent")}
            onGuest={() => shell.goTo("guest")}
            t={t}
          />
        )}

        {shell.view === "parent" && (
          <div className="shell-stack-lg">
            <button
              className="shell-back"
              onClick={() => shell.goTo("picker")}
            >
              {t.appShell.backToChildEntry}
            </button>
            <LanguageProvider>
              <ParentAuth />
            </LanguageProvider>
          </div>
        )}

        {shell.view === "picker" && (
          <Picker
            profiles={shell.pickerProfiles}
            onLoggedIn={shell.completeChildSignin}
            onParentGate={() => shell.goTo("parent_gate")}
            t={t}
          />
        )}

        {shell.view === "parent_gate" && (
          <ParentGate
            status={shell.gateStatus}
            onSubmit={(email, pw) => void shell.submitGate(email, pw)}
            onBack={() => shell.goTo("picker")}
            t={t}
          />
        )}

        {shell.view === "child" && shell.activeChild && (
          <ChildMode
            profile={shell.activeChild}
            onSwitchUser={() => shell.goTo("picker")}
            t={t}
          />
        )}

        {shell.view === "guest" && (
          <GuestMode
            onCreateAccount={() => shell.goTo("parent")}
            onBack={() => shell.goTo("landing")}
            t={t}
          />
        )}
      </div>

      {shell.migrationOffer && (
        <MigrationSheet
          name={shell.migrationOffer.profile.display_name}
          lessonCount={shell.migrationOffer.lessonCount}
          onAccept={() => void shell.acceptMigration()}
          onDecline={shell.declineMigration}
          t={t}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Landing — ingen forælder-session på enheden
// ----------------------------------------------------------------------------

function Landing({
  onParent,
  onGuest,
  t,
}: {
  onParent: () => void;
  onGuest: () => void;
  t: Dictionary;
}) {
  return (
    <div className="shell-screen">
      <div className="shell-logo">
        <div className="shell-lamp" aria-hidden>
          🏮
        </div>
        <h1 className="shell-title">Nour</h1>
        <p className="shell-title-ar" dir="rtl" lang="ar">
          نور
        </p>
        <p className="shell-sub">{t.appShell.tagline}</p>
      </div>
      <div className="shell-stack">
        <button className="shell-btn shell-btn-gold" onClick={onParent}>
          {t.appShell.parentLoginLabel}
        </button>
        <button className="shell-btn shell-btn-ghost" onClick={onGuest}>
          {t.appShell.tryWithoutAccount}
        </button>
        <p className="shell-hint shell-center">{t.appShell.guestHint}</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Børne-indgangen — PinLogin med familiens profiler (RLS: kun egne)
// ----------------------------------------------------------------------------

function Picker({
  profiles,
  onLoggedIn,
  onParentGate,
  t,
}: {
  profiles: PinLoginProfile[] | null;
  onLoggedIn: (
    profileId: string,
    credentials: ChildSigninCredentials,
  ) => Promise<boolean>;
  onParentGate: () => void;
  t: Dictionary;
}) {
  return (
    <div className="shell-screen">
      {profiles === null ? (
        <p className="shell-hint shell-center" style={{ marginTop: 48 }}>
          {t.appShell.loadingProfiles}
        </p>
      ) : profiles.length === 0 ? (
        <div className="shell-card" style={{ marginTop: 40 }}>
          <h3>{t.appShell.noProfilesHeading}</h3>
          <p>{t.appShell.noProfilesText}</p>
        </div>
      ) : (
        <PinLogin skin="mid" profiles={profiles} onLoggedIn={onLoggedIn} />
      )}
      <div className="shell-parent-link">
        <button className="shell-btn-quiet" onClick={onParentGate}>
          {t.appShell.parentLockButton}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Forældre-porten — adgangskode før dashboardet (slette-knapperne bor dér)
// ----------------------------------------------------------------------------

function ParentGate({
  status,
  onSubmit,
  onBack,
  t,
}: {
  status: "idle" | "checking" | "wrong";
  onSubmit: (email: string, password: string) => void;
  onBack: () => void;
  t: Dictionary;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const checking = status === "checking";
  const canSubmit = email.trim().length > 0 && password.length > 0 && !checking;

  return (
    <div className="shell-screen">
      <div className="shell-topbar">
        <button className="shell-back" onClick={onBack}>
          {t.appShell.back}
        </button>
        <span className="shell-topbar-title">{t.appShell.adultsOnly}</span>
        <span className="shell-topbar-spacer" />
      </div>
      <div className="shell-card">
        <h3>{t.appShell.parentLoginLabel}</h3>
        <p>{t.appShell.parentGateIntro}</p>
        <input
          type="email"
          className="shell-input"
          placeholder={t.appShell.emailPlaceholder}
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) onSubmit(email, password);
          }}
        />
        <input
          type="password"
          className="shell-input"
          placeholder={t.appShell.passwordPlaceholder}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) onSubmit(email, password);
          }}
        />
        <p className="shell-field-err" role="alert">
          {status === "wrong" ? t.appShell.wrongCredentials : ""}
        </p>
      </div>
      <div className="shell-stack">
        <button
          className="shell-btn shell-btn-gold"
          disabled={!canSubmit}
          onClick={() => onSubmit(email, password)}
        >
          {checking ? t.appShell.checking : t.appShell.openParentArea}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Lukket børne-tilstand — verdenskort + lektioner på barnets profil
// ----------------------------------------------------------------------------

function ChildMode({
  profile,
  onSwitchUser,
  t,
}: {
  profile: Profile;
  onSwitchUser: () => void;
  t: Dictionary;
}) {
  const skin: AgeSkin = ageSkinForBirthYear(profile.birth_year);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [showHistorier, setShowHistorier] = useState(false);
  const [mapRefresh, setMapRefresh] = useState(0);

  return (
    <div className="shell-screen" data-age-skin={skin}>
      <div className="shell-worldbar">
        <span className="shell-avatar-s" aria-hidden>
          {profile.avatar ?? "🏮"}
        </span>
        <span className="shell-who">{profile.display_name}</span>
        <span className="shell-voice-pill">{voiceLabel(profile.preferred_voice, t)}</span>
      </div>

      {activeLessonId ? (
        <LessonScreen
          lessonId={activeLessonId}
          skin={skin}
          level={profile.current_level}
          showTransliteration={profile.transliteration_enabled}
          profileId={profile.id}
          onExit={() => {
            setActiveLessonId(null);
            setMapRefresh((n) => n + 1);
          }}
        />
      ) : showHistorier ? (
        <HistorierBjergeScreen
          skin={skin}
          birthYear={profile.birth_year}
          onExit={() => setShowHistorier(false)}
        />
      ) : (
        <>
          <WorldMap
            key={mapRefresh}
            skin={skin}
            profileId={profile.id}
            onOpenLesson={setActiveLessonId}
            onOpenHistorier={() => setShowHistorier(true)}
          />
          <div className="shell-stack">
            <button className="shell-btn shell-btn-ghost" onClick={onSwitchUser}>
              {t.appShell.switchUser}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Gæste-sti — prøve-indgang med "gem dit lys"-opfordring (intern navigation)
// ----------------------------------------------------------------------------

function GuestMode({
  onCreateAccount,
  onBack,
  t,
}: {
  onCreateAccount: () => void;
  onBack: () => void;
  t: Dictionary;
}) {
  const [skin, setSkin] = useState<AgeSkin>("mid");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [showHistorier, setShowHistorier] = useState(false);
  const [mapRefresh, setMapRefresh] = useState(0);

  return (
    <div className="shell-screen" data-age-skin={skin}>
      <div className="shell-guest-banner">
        <span aria-hidden style={{ fontSize: "1.4rem" }}>
          🏮
        </span>
        <span className="shell-guest-text">
          <b>{t.appShell.guestBannerBold}</b>
          {t.appShell.guestBannerText}
        </span>
        <button className="shell-guest-cta" onClick={onCreateAccount}>
          {t.appShell.guestCreateCta}
        </button>
      </div>

      {activeLessonId ? (
        <LessonScreen
          lessonId={activeLessonId}
          skin={skin}
          level={1}
          showTransliteration
          onExit={() => {
            setActiveLessonId(null);
            setMapRefresh((n) => n + 1);
          }}
        />
      ) : showHistorier ? (
        <HistorierBjergeScreen skin={skin} onExit={() => setShowHistorier(false)} />
      ) : (
        <>
          <div className="shell-skin-row" role="group" aria-label={t.appShell.ageGroupAriaLabel}>
            {(["soft", "mid", "teen"] as const).map((s) => (
              <button
                key={s}
                className={`shell-skin-btn ${skin === s ? "shell-skin-btn-on" : ""}`}
                onClick={() => setSkin(s)}
              >
                {s === "soft" ? "3–6" : s === "mid" ? "7–10" : "11–14"}
              </button>
            ))}
          </div>
          <WorldMap
            key={`${skin}-${mapRefresh}`}
            skin={skin}
            onOpenLesson={setActiveLessonId}
            onOpenHistorier={() => setShowHistorier(true)}
          />
          <div className="shell-stack">
            <button className="shell-btn-quiet" onClick={onBack}>
              {t.appShell.backToLanding}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Migrerings-prompt — "tag dit lys med" (gæst → profil, engangs)
// ----------------------------------------------------------------------------

function MigrationSheet({
  name,
  lessonCount,
  onAccept,
  onDecline,
  t,
}: {
  name: string;
  lessonCount: number;
  onAccept: () => void;
  onDecline: () => void;
  t: Dictionary;
}) {
  return (
    <div className="shell-overlay" role="dialog" aria-modal="true">
      <div className="shell-sheet">
        <h3>{t.appShell.migrationHeading}</h3>
        <p>
          {t.appShell.migrationIntro}{" "}
          <b>{t.appShell.migrationLessonPhrase(lessonCount)}</b>
          {t.appShell.migrationQuestionLead} <b>{name}</b> {t.appShell.migrationQuestionTail}
        </p>
        <div className="shell-stack" style={{ paddingTop: 0 }}>
          <button className="shell-btn shell-btn-gold" onClick={onAccept}>
            {t.appShell.migrationAccept}
          </button>
          <button className="shell-btn-quiet" onClick={onDecline}>
            {t.appShell.migrationDecline}
          </button>
        </div>
        <p className="shell-hint" style={{ marginTop: 10 }}>
          {t.appShell.migrationHint}
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Stjernehimmel — samme rolige baggrund som parent-auth-scenen
// ----------------------------------------------------------------------------

function ShellStars() {
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, () => ({
        left: `${(Math.random() * 100).toFixed(1)}%`,
        top: `${(Math.random() * 70).toFixed(1)}%`,
        size: Math.random() * 1.6 + 0.6,
        delay: `${(Math.random() * 4).toFixed(1)}s`,
      })),
    [],
  );
  return (
    <div className="shell-stars" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="shell-star"
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
  );
}
