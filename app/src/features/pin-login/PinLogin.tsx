/**
 * PinLogin — barnets billede-pinkode-login (plan-pin-login-port.md).
 *
 * Ingen email, ingen tekst-kode: barnet vælger sin profil (avatar-cirkel)
 * og trykker sin dyre-rækkefølge. Lukket skærm, ingen navigation ud
 * (børnesikkerhed) udover "← Skift profil".
 *
 * Design-fakta portet 1:1 fra ejer-godkendt demo (nour-pinkode-demo.html):
 *   Nattehimmel #0B1330, guld-glød #F5B942, cremet tekst #F5EDDD,
 *   dæmpet guld #C9A46B. Flow: profilvælger → pin-skærm → velkomst.
 *   Skind: soft 9 dyr/3 kol, kæmpeknapper · mid 9 dyr/3 kol · teen 12
 *   dyr/4 kol, strammere.
 *
 * Profiler sendes ind som prop (ren UI+RPC — henter intet selv i denne
 * leverance; forælder-hentning kommer med samtykke-flowet i leverance 2).
 *
 * MUREN: rører kun profiles (via RPC) — aldrig content/aqidah.
 */

import { useMemo } from "react";
import type { AgeSkin, Profile } from "@/lib/types";
import { ANIMAL_POOL, SKIN_PARAMS } from "./engine";
import { usePinLogin } from "./usePinLogin";
import "./pin-login.css";

export interface PinLoginProps {
  skin: AgeSkin;
  profiles: readonly Profile[];
  onLoggedIn: (profile: Profile) => void;
}

export function PinLogin({ skin, profiles, onLoggedIn }: PinLoginProps) {
  const {
    phase,
    activeProfile,
    entered,
    status,
    needsAdultHelp,
    chooseProfile,
    pressAnimal,
    backToPicker,
  } = usePinLogin({ onLoggedIn });

  const stars = useMemo(
    () =>
      Array.from({ length: 36 }, () => ({
        left: `${(Math.random() * 100).toFixed(1)}%`,
        top: `${(Math.random() * 70).toFixed(1)}%`,
        size: Math.random() * 1.6 + 0.6,
        delay: `${(Math.random() * 4).toFixed(1)}s`,
      })),
    [],
  );

  return (
    <div
      data-age-skin={skin}
      className="pin-scene relative mx-auto w-full max-w-md overflow-hidden rounded-(--radius-skin) px-5 py-8 sm:px-8"
    >
      <div className="pin-stars" aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            className="pin-star"
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
        {phase === "pin" && activeProfile ? (
          <button
            type="button"
            onClick={backToPicker}
            className="pin-link mb-4 text-sm font-semibold"
          >
            ← Skift profil
          </button>
        ) : null}

        {phase === "picker" ? (
          <ProfilePicker skin={skin} profiles={profiles} onChoose={chooseProfile} />
        ) : null}

        {phase === "pin" && activeProfile ? (
          <PinPad
            skin={skin}
            profile={activeProfile}
            entered={entered}
            status={status}
            needsAdultHelp={needsAdultHelp}
            onPressAnimal={pressAnimal}
          />
        ) : null}

        {phase === "welcome" && activeProfile ? (
          <Welcome skin={skin} profile={activeProfile} />
        ) : null}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Profilvælger — avatar-cirkler med glød
// ----------------------------------------------------------------------------

function ProfilePicker({
  skin,
  profiles,
  onChoose,
}: {
  skin: AgeSkin;
  profiles: readonly Profile[];
  onChoose: (profile: Profile) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <h2
        className={`pin-title font-bold ${skin === "soft" ? "text-3xl" : "text-2xl"}`}
      >
        Hvem er du?
      </h2>
      <div
        className={`grid gap-5 ${
          profiles.length > 2 ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChoose(p)}
            className={`pin-avatar flex flex-col items-center gap-2 rounded-full transition-transform active:scale-95 ${
              skin === "soft" ? "p-2" : "p-1.5"
            }`}
          >
            <span
              className={`pin-avatar-circle flex items-center justify-center rounded-full ${
                skin === "soft" ? "size-24 text-5xl" : skin === "mid" ? "size-20 text-4xl" : "size-16 text-3xl"
              }`}
              aria-hidden
            >
              {p.avatar ?? "🌟"}
            </span>
            <span className="pin-name font-semibold">{p.display_name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pin-skærm — lys-pladser (viser fremskridt) + dyre-grid
// ----------------------------------------------------------------------------

function PinPad({
  skin,
  profile,
  entered,
  status,
  needsAdultHelp,
  onPressAnimal,
}: {
  skin: AgeSkin;
  profile: Profile;
  entered: readonly string[];
  status: "idle" | "checking" | "wrong" | "network_error";
  needsAdultHelp: boolean;
  onPressAnimal: (poolIndex: number) => void;
}) {
  const params = SKIN_PARAMS[skin];
  const animals = ANIMAL_POOL.slice(0, params.animalCount);
  // Antal lys-pladser vist: vi kender ikke den faktiske pin-længde (hashen
  // forlader aldrig DB'en), så vi viser pladser i takt med det indtastede —
  // et nyt tomt plads-slot dukker op efter hvert tryk, op til et rimeligt loft.
  const slotCount = Math.max(4, Math.min(6, entered.length + 1));

  return (
    <div className="flex flex-col items-center gap-6 py-2 text-center">
      <div className="flex flex-col items-center gap-1">
        <span
          className={`pin-avatar-circle flex items-center justify-center rounded-full ${
            skin === "soft" ? "size-20 text-4xl" : "size-16 text-3xl"
          }`}
          aria-hidden
        >
          {profile.avatar ?? "🌟"}
        </span>
        <h2 className={`pin-title font-bold ${skin === "soft" ? "text-2xl" : "text-xl"}`}>
          Hej {profile.display_name}! Vis din kode
        </h2>
      </div>

      <div
        className={`flex justify-center gap-2.5 ${status === "wrong" ? "pin-shake" : ""}`}
        aria-label="Din kode"
      >
        {Array.from({ length: slotCount }, (_, i) => {
          const filled = i < entered.length;
          return (
            <span
              key={i}
              className={`pin-slot rounded-full transition-all ${
                skin === "soft" ? "size-5" : "size-4"
              } ${filled ? "pin-slot-lit" : ""}`}
            />
          );
        })}
      </div>

      <FeedbackLine status={status} needsAdultHelp={needsAdultHelp} skin={skin} />

      <div
        className="grid gap-3 sm:gap-4"
        style={{ gridTemplateColumns: `repeat(${params.gridCols}, minmax(0, 1fr))` }}
      >
        {animals.map((emoji, index) => (
          <button
            key={index}
            type="button"
            disabled={status === "checking"}
            onClick={() => onPressAnimal(index)}
            className={`pin-animal-btn flex flex-col items-center justify-center rounded-(--radius-skin) transition-transform active:scale-90 ${
              skin === "soft" ? "size-20 text-4xl" : skin === "mid" ? "size-16 text-3xl" : "size-14 text-2xl"
            }`}
          >
            <span aria-hidden>{emoji}</span>
            {params.showOrderHint ? (
              <span className="pin-order-hint text-[0.65rem] font-bold">{index + 1}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackLine({
  status,
  needsAdultHelp,
  skin,
}: {
  status: "idle" | "checking" | "wrong" | "network_error";
  needsAdultHelp: boolean;
  skin: AgeSkin;
}) {
  if (needsAdultHelp && status === "wrong") {
    return (
      <p className="pin-feedback pin-feedback-help text-sm font-semibold">
        Prøv igen sammen med en voksen 🤝
      </p>
    );
  }
  if (status === "wrong") {
    return (
      <p className="pin-feedback text-sm font-semibold">
        {skin === "soft" ? "Prøv igen! 🌙" : "Ikke helt — prøv igen"}
      </p>
    );
  }
  if (status === "network_error") {
    return (
      <p className="pin-feedback text-sm font-semibold">
        Kunne ikke tjekke koden — prøv igen om lidt
      </p>
    );
  }
  if (status === "checking") {
    return <p className="pin-feedback text-sm opacity-70">Tjekker …</p>;
  }
  return <p className="pin-feedback text-sm opacity-0 select-none">&nbsp;</p>;
}

// ----------------------------------------------------------------------------
// Velkomst
// ----------------------------------------------------------------------------

function Welcome({ skin, profile }: { skin: AgeSkin; profile: Profile }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <span
        className={`pin-avatar-circle pin-welcome-glow flex items-center justify-center rounded-full ${
          skin === "soft" ? "size-28 text-6xl" : "size-24 text-5xl"
        }`}
        aria-hidden
      >
        {profile.avatar ?? "🌟"}
      </span>
      <h2 className={`pin-title font-bold ${skin === "soft" ? "text-3xl" : "text-2xl"}`}>
        Velkommen, {profile.display_name}! ✨
      </h2>
    </div>
  );
}
