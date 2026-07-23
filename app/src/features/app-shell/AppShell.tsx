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
import { useAppShell } from "./useAppShell";
import "./app-shell.css";

const VOICE_LABEL: Record<string, string> = {
  female: "🔊 Habibah ♀",
  male: "🔊 Ahmed ♂",
};

export function AppShell() {
  const shell = useAppShell();

  return (
    <div className="shell-scene">
      <ShellStars />
      <div className="shell-app">
        {shell.view === "loading" && (
          <p className="shell-hint shell-center">Tænder lanternerne …</p>
        )}

        {shell.view === "landing" && (
          <Landing
            onParent={() => shell.goTo("parent")}
            onGuest={() => shell.goTo("guest")}
          />
        )}

        {shell.view === "parent" && (
          <div className="shell-stack-lg">
            <button
              className="shell-back"
              onClick={() => shell.goTo("picker")}
            >
              ‹ Til børne-indgangen
            </button>
            <ParentAuth />
          </div>
        )}

        {shell.view === "picker" && (
          <Picker
            profiles={shell.pickerProfiles}
            onLoggedIn={shell.completeChildSignin}
            onParentGate={() => shell.goTo("parent_gate")}
          />
        )}

        {shell.view === "parent_gate" && (
          <ParentGate
            status={shell.gateStatus}
            onSubmit={(email, pw) => void shell.submitGate(email, pw)}
            onBack={() => shell.goTo("picker")}
          />
        )}

        {shell.view === "child" && shell.activeChild && (
          <ChildMode
            profile={shell.activeChild}
            onSwitchUser={() => shell.goTo("picker")}
          />
        )}

        {shell.view === "guest" && (
          <GuestMode
            onCreateAccount={() => shell.goTo("parent")}
            onBack={() => shell.goTo("landing")}
          />
        )}
      </div>

      {shell.migrationOffer && (
        <MigrationSheet
          name={shell.migrationOffer.profile.display_name}
          lessonCount={shell.migrationOffer.lessonCount}
          onAccept={() => void shell.acceptMigration()}
          onDecline={shell.declineMigration}
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
}: {
  onParent: () => void;
  onGuest: () => void;
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
        <p className="shell-sub">Lær arabisk — og lad lyset vokse</p>
      </div>
      <div className="shell-stack">
        <button className="shell-btn shell-btn-gold" onClick={onParent}>
          Log ind som forælder
        </button>
        <button className="shell-btn shell-btn-ghost" onClick={onGuest}>
          Prøv uden konto
        </button>
        <p className="shell-hint shell-center">
          Uden konto gemmes fremskridt kun på denne enhed. En forælder-konto
          gemmer barnets lys sikkert.
        </p>
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
}: {
  profiles: PinLoginProfile[] | null;
  onLoggedIn: (
    profileId: string,
    credentials: ChildSigninCredentials,
  ) => Promise<boolean>;
  onParentGate: () => void;
}) {
  return (
    <div className="shell-screen">
      {profiles === null ? (
        <p className="shell-hint shell-center" style={{ marginTop: 48 }}>
          Henter profiler …
        </p>
      ) : profiles.length === 0 ? (
        <div className="shell-card" style={{ marginTop: 40 }}>
          <h3>Ingen børneprofiler endnu</h3>
          <p>
            Åbn forældre-området for at oprette den første profil — så tændes
            barnets egen lanterne.
          </p>
        </div>
      ) : (
        <PinLogin skin="mid" profiles={profiles} onLoggedIn={onLoggedIn} />
      )}
      <div className="shell-parent-link">
        <button className="shell-btn-quiet" onClick={onParentGate}>
          🔒 Forældre
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
}: {
  status: "idle" | "checking" | "wrong";
  onSubmit: (email: string, password: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const checking = status === "checking";
  const canSubmit = email.trim().length > 0 && password.length > 0 && !checking;

  return (
    <div className="shell-screen">
      <div className="shell-topbar">
        <button className="shell-back" onClick={onBack}>
          ‹ Tilbage
        </button>
        <span className="shell-topbar-title">Kun for voksne</span>
        <span className="shell-topbar-spacer" />
      </div>
      <div className="shell-card">
        <h3>Log ind som forælder</h3>
        <p>
          Indtast din e-mail og adgangskode for at åbne forældre-området. Her kan
          man oprette og slette børneprofiler.
        </p>
        <input
          type="email"
          className="shell-input"
          placeholder="E-mail"
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
          placeholder="Adgangskode"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) onSubmit(email, password);
          }}
        />
        <p className="shell-field-err" role="alert">
          {status === "wrong" ? "Forkert e-mail eller adgangskode. Prøv igen." : ""}
        </p>
      </div>
      <div className="shell-stack">
        <button
          className="shell-btn shell-btn-gold"
          disabled={!canSubmit}
          onClick={() => onSubmit(email, password)}
        >
          {checking ? "Tjekker …" : "Åbn forældre-området"}
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
}: {
  profile: Profile;
  onSwitchUser: () => void;
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
        <span className="shell-voice-pill">
          {VOICE_LABEL[profile.preferred_voice ?? "female"] ??
            VOICE_LABEL.female}
        </span>
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
              Skift bruger
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
}: {
  onCreateAccount: () => void;
  onBack: () => void;
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
          <b>Gem dit lys.</b> Lige nu husker kun denne enhed dit fremskridt.
          Bed en voksen oprette en gratis forælder-konto — så følger lyset med
          dig.
        </span>
        <button className="shell-guest-cta" onClick={onCreateAccount}>
          Opret →
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
          <div className="shell-skin-row" role="group" aria-label="Alder">
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
              ‹ Til forsiden
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
}: {
  name: string;
  lessonCount: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="shell-overlay" role="dialog" aria-modal="true">
      <div className="shell-sheet">
        <h3>🏮 Der er lys gemt på denne enhed</h3>
        <p>
          Nogen har spillet som gæst her og samlet lys i{" "}
          <b>
            {lessonCount} lektion{lessonCount === 1 ? "" : "er"}
          </b>
          . Skal <b>{name}</b> tage det med ind på sin profil?
        </p>
        <div className="shell-stack" style={{ paddingTop: 0 }}>
          <button className="shell-btn shell-btn-gold" onClick={onAccept}>
            Ja — tag lyset med ✨
          </button>
          <button className="shell-btn-quiet" onClick={onDecline}>
            Nej, det var ikke mig
          </button>
        </div>
        <p className="shell-hint" style={{ marginTop: 10 }}>
          Vælger du nej, bliver gæste-lyset på enheden og kan tages med af en
          anden profil senere.
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
