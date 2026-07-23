/**
 * useAppShell — appens øverste state-maskine (ejer-godkendt demo
 * nour-app-skal-demo.html, milepælen "Barnets rejse → profilen").
 *
 * Delt-enhed-modellen (arkitektur-faktum fra RLS): PROFILLISTEN kræver
 * fortsat forælderens Supabase-session at HENTE (`owner_account_id =
 * auth.uid()`) — barnets indgang forudsætter derfor at forælderen har
 * logget ind på enheden mindst én gang i denne app-session. MEN siden
 * Leverance B2 er dyre-pinnen ikke længere kun en UI-port: en bestået pin
 * (eller en ulåst profil) udsteder nu barnets EGEN, rigtige Supabase-
 * session (se `completeChildSignin`) — RLS'en fra B1 (`profiles_child_
 * select_own` m.fl.) er det der reelt beskytter søskende fra hinanden,
 * ikke længere kun UI'et.
 *
 * To identiteter, aldrig begge aktive samtidig (plan-boernesession-og-
 * dashboard.md del 7, spørgsmål 2): et barne-login signer eksplicit
 * forælderen HELT ud først. Den allerede hentede profilliste bevares i
 * React-state hen over skiftet (se `goTo("picker")`), så søskende kan
 * skifte mellem hinanden uden at en voksen skal logge ind igen — en
 * gen-hentning under et barns session ville alligevel fejle (RLS viser
 * kun barnet selv) og tømme listen for de andre. Fuld "bootstrap picker
 * uden nogensinde at have haft en forælder-session" (enheds-roster) er
 * Leverance B4, ikke denne.
 *
 * Visninger:
 *   loading      — boot: supabase.auth.getSession()
 *   landing      — ingen session: "Log ind som forælder" / "Prøv uden konto"
 *   parent       — forældre-området (ParentAuth: login → samtykke → dashboard)
 *   picker       — børne-indgangen (PinLogin: profilvælger → dyre-pin)
 *   parent_gate  — fuld reautentificering (e-mail+adgangskode) fra picker
 *                  → parent. IKKE længere kun "genindtast kodeord for den
 *                  allerede indloggede" (B2): den aktive session kan være
 *                  et BARNS, så porten skal kunne skifte identitet helt.
 *                  Barnet må aldrig kunne nå slette-knapperne.
 *   child        — lukket børne-tilstand: verdenskort + lektioner på profilen
 *   guest        — prøve-indgang: lokal-gem + venlig "gem dit lys"-opfordring
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { setVoicePref } from "@/lib/voicePref";
import { startSyncEngine } from "@/lib/progressQueue";
import { rememberChildInRoster } from "@/lib/childRoster";
import type { Profile } from "@/lib/types";
import type { ChildSigninCredentials } from "@/features/pin-login";
import {
  checkGuestMigration,
  fetchOwnProfiles,
  migrateGuestProgress,
} from "./engine";

export type ShellView =
  | "loading"
  | "landing"
  | "parent"
  | "picker"
  | "parent_gate"
  | "child"
  | "guest";

export function useAppShell() {
  const [view, setView] = useState<ShellView>("loading");
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [activeChild, setActiveChild] = useState<Profile | null>(null);
  const [migrationOffer, setMigrationOffer] = useState<{
    profile: Profile;
    lessonCount: number;
  } | null>(null);
  const [gateStatus, setGateStatus] = useState<"idle" | "checking" | "wrong">(
    "idle",
  );
  // Porten passeres for sessionens levetid i skallen — barnet skal ikke
  // kunne "gå tilbage" ind i et åbent forældre-område, men forælderen skal
  // heller ikke taste kode ved hvert klik mellem dashboard og børne-indgang.
  const gatePassed = useRef(false);
  // Sand mens et KONTROLLERET session-skifte kører (barnets pin-login ELLER
  // forældre-portens fulde reautentificering). onAuthStateChange skal
  // IGNORERE de SIGNED_OUT/SIGNED_IN-events det udløser undervejs — den
  // ansvarlige funktion styrer selv view-skiftet til sidst.
  const authTransitionInFlight = useRef(false);

  const loadProfiles = useCallback(async () => {
    setProfiles(await fetchOwnProfiles());
  }, []);

  // Boot + reaktion på login/logout (fx "log ud" inde i dashboardet).
  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        void loadProfiles();
        setView("picker");
      } else {
        setView("landing");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (authTransitionInFlight.current) return;
      if (event === "SIGNED_OUT") {
        gatePassed.current = false;
        setProfiles(null);
        setActiveChild(null);
        setMigrationOffer(null);
        setView("landing");
      }
      if (event === "SIGNED_IN") {
        // Forbliv i forældre-området (samtykke/dashboard håndteres af
        // ParentAuth) — men gør profillisten klar til børne-indgangen.
        void loadProfiles();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfiles]);

  // Leverance 1.1: tøm den offline-kø der måtte være liggende fra sidste
  // session (app-start), og igen hver gang enheden bliver online. Billigt
  // no-op når køen er tom — kører derfor uafhængigt af login-status.
  useEffect(() => startSyncEngine(), []);

  /** Barnet har bestået dyre-pinnen (eller profilen er ulåst). */
  const onChildLoggedIn = useCallback((profile: Profile) => {
    setActiveChild(profile);
    // Stemmen følger profilen (ejer-godkendt): skriv ind i det eksisterende
    // voicePref-lager, så alle spil forbliver urørte.
    setVoicePref(profile.preferred_voice === "male" ? "male" : "female");
    // Enheds-lokal roster (Leverance B2-infrastruktur, fuldt taget i brug
    // først i B4): husk barnet, så "Glem denne enhed" har noget at rydde,
    // og så B4 kan starte herfra uden en ny dataindsamling.
    rememberChildInRoster({
      profileId: profile.id,
      displayName: profile.display_name,
      avatar: profile.avatar,
    });

    void checkGuestMigration(profile.id).then((check) => {
      if (check.shouldOffer) {
        setMigrationOffer({ profile, lessonCount: check.guestLessonCount });
      } else {
        setView("child");
      }
    });
  }, []);

  /**
   * Leverance B2: pin'en er bekræftet af serveren (child-signin). Skift
   * den AKTIVE Supabase-session fra forælderens til barnets EGEN — signOut
   * FØRST (eksplicit, jf. planens del 7 spørgsmål 2: "log helt ud"), derefter
   * verifyOtp med engangs-tokenet. Fail-closed ved fejl: ingen session er
   * bedre end en forkert én.
   */
  const completeChildSignin = useCallback(
    async (profile: Profile, credentials: ChildSigninCredentials) => {
      authTransitionInFlight.current = true;
      let ok = false;
      try {
        await supabase.auth.signOut();
        const { error } = await supabase.auth.verifyOtp({
          email: credentials.email,
          token: credentials.tokenHash,
          type: "magiclink",
        });
        ok = !error;
      } catch {
        ok = false;
      } finally {
        authTransitionInFlight.current = false;
      }

      if (!ok) {
        gatePassed.current = false;
        setProfiles(null);
        setActiveChild(null);
        setView("landing");
        return false;
      }

      // SIKKERHEDSKRITISK: den aktive identitet er nu barnets, ikke
      // forælderens. En tidligere bestået forældre-port (`gatePassed`)
      // gjaldt forælderens session — den må IKKE overleve identitetsskiftet,
      // ellers kunne barnet gå picker → "🔒 Forælder" → parent_gate og
      // springe lige ind i dashboardet uden kodeord.
      gatePassed.current = false;
      onChildLoggedIn(profile);
      return true;
    },
    [onChildLoggedIn],
  );

  /** "Ja — tag lyset med": flyt gæste-fremskridt ind på profilen. */
  const acceptMigration = useCallback(async () => {
    if (!migrationOffer) return;
    await migrateGuestProgress(migrationOffer.profile);
    // Fail-soft: fejler skrivningen, forbliver gæste-lyset på enheden og
    // kan tages med næste gang — barnet kommer ind uanset.
    setMigrationOffer(null);
    setView("child");
  }, [migrationOffer]);

  /** "Nej, det var ikke mig": gæste-lyset bliver på enheden. */
  const declineMigration = useCallback(() => {
    setMigrationOffer(null);
    setView("child");
  }, []);

  /**
   * Forældre-porten: FULD reautentificering (e-mail+adgangskode), ikke
   * kun kodeord-genindtastning (B2-ændring — se filens toppkommentar).
   * signOut FØRST, ligesom completeChildSignin: uanset om der lige nu er
   * en barne-session, en anden forælders session, eller slet ingen, skal
   * porten virke ens. Ved succes gen-hentes profillisten under den nu
   * bekræftede forælder-session — det opdaterer også en evt. forældet
   * cached liste (fx et nyt barn oprettet fra en anden enhed).
   */
  const submitGate = useCallback(
    async (email: string, password: string) => {
      setGateStatus("checking");
      authTransitionInFlight.current = true;
      let ok = false;
      try {
        await supabase.auth.signOut();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        ok = !error;
      } catch {
        ok = false;
      } finally {
        authTransitionInFlight.current = false;
      }

      if (!ok) {
        setGateStatus("wrong");
        return;
      }

      gatePassed.current = true;
      setGateStatus("idle");
      setActiveChild(null);
      await loadProfiles();
      setView("parent");
    },
    [loadProfiles],
  );

  const goTo = useCallback(
    (target: Exclude<ShellView, "loading">) => {
      if (target === "parent_gate") setGateStatus("idle");
      if (target === "picker") {
        setActiveChild(null);
        if (profiles !== null) {
          // Familiens profilliste er allerede hentet under forælderens
          // session tidligere i DENNE app-session. Et barns egen session
          // (Leverance B2) har ikke RLS-adgang til at gen-hente den — og
          // gør heller ikke behov for det: listen er stadig gyldig, indtil
          // en forælder rent faktisk logger ind igen. Gen-hentning her
          // ville vise en tom liste for de øvrige søskende. Gå derfor
          // direkte til profilvælgeren, så børn kan skifte uden en voksen.
          setView("picker");
          return;
        }
        // Ingen kendt liste endnu (frisk app-start uden aktiv session):
        // børne-indgangen kræver en forælder-session (delt-enhed-modellen).
        // Uden session: forsiden — aldrig en tom, vildledende profilvælger.
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            void loadProfiles();
            setView("picker");
          } else {
            setView("landing");
          }
        });
        return;
      }
      // Fra picker mod forældre-området: spring porten over hvis den
      // allerede er passeret i denne session.
      if (target === "parent_gate" && gatePassed.current) {
        setView("parent");
        return;
      }
      setView(target);
    },
    [loadProfiles, profiles],
  );

  return {
    view,
    profiles,
    activeChild,
    migrationOffer,
    gateStatus,
    onChildLoggedIn,
    completeChildSignin,
    acceptMigration,
    declineMigration,
    submitGate,
    goTo,
  };
}
