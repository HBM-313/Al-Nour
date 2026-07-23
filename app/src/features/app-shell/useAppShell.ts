/**
 * useAppShell — appens øverste state-maskine (ejer-godkendt demo
 * nour-app-skal-demo.html, milepælen "Barnets rejse → profilen").
 *
 * Leverance B4 (plan-boernesession-og-dashboard.md del 4): skallen har to
 * RIGTIGE indgange, ikke længere kun én vej gennem forælderens session:
 *
 *   1. Session findes og er et BARNS EGEN (kendes ved at et af de
 *      hentede profil-rækker har `auth_user_id === session.user.id`,
 *      jf. RLS `profiles_child_select_own`) → genoptag direkte i
 *      "child"-tilstand. Løser B2's kendte begrænsning: en side-
 *      genindlæsning midt i en barnesession endte hidtil på pin-skærmen.
 *      Ejer-beslutning (denne session): mindst friktion — INGEN pin
 *      genindtastes ved en gyldig, ikke-udløbet session.
 *   2. Session findes og er FORÆLDERENS (ingen af profilerne matcher) →
 *      uændret adfærd: picker med den fulde profilliste.
 *   3. Ingen session, men enheds-roster'en (lib/childRoster.ts) husker
 *      børn fra et tidligere login på DENNE enhed → picker bygget på
 *      roster-kortene (kun {profileId, displayName, avatar, hasPin} —
 *      ALDRIG forælderens data). Samme pin-flow som ellers.
 *   4. Ingen session, tom roster (helt frisk enhed) → Landing. Et barn
 *      har reelt intet at gøre her uden en forælder først (del 5.2) —
 *      "Log ind som forælder" ER svaret på "er du forælder eller barn"
 *      i det tilfælde.
 *
 * Uanset hvilken vej et barn logger ind ad, henter `completeChildSignin`
 * den KANONISKE profil frisk under barnets egen, nu bekræftede session
 * (samme RLS, samme `fetchOwnProfiles()`) — nødvendigt fordi et
 * roster-kort ikke kender fødselsår/stemmevalg/niveau, og fordi det
 * retter enhver forældet cache uden ekstra kode.
 *
 * To identiteter, aldrig begge aktive samtidig (plan del 7, spørgsmål 2):
 * et barne-login signer eksplicit forælderen HELT ud først, og et skift
 * VÆK fra en barnesession (fx "Skift bruger") signer barnet ud igen FØR
 * picker'en vises — en barnesession kan (RLS) kun se sig selv, så
 * søskende-kortene skal komme fra roster'en, ikke fra en gen-hentning
 * under den forkerte identitet.
 *
 * Visninger:
 *   loading      — boot: supabase.auth.getSession()
 *   landing      — ingen session, tom roster: "Log ind som forælder" / "Prøv uden konto"
 *   parent       — forældre-området (ParentAuth: login → samtykke → dashboard)
 *   picker       — børne-indgangen (PinLogin: profilvælger → dyre-pin)
 *   parent_gate  — fuld reautentificering (e-mail+adgangskode) fra picker
 *                  → parent. IKKE kun "genindtast kodeord for den
 *                  allerede indloggede" (B2): den aktive session kan være
 *                  et BARNS, så porten skal kunne skifte identitet helt.
 *                  Barnet må aldrig kunne nå slette-knapperne.
 *   child        — lukket børne-tilstand: verdenskort + lektioner på profilen
 *   guest        — prøve-indgang: lokal-gem + venlig "gem dit lys"-opfordring
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { setVoicePref } from "@/lib/voicePref";
import { startSyncEngine } from "@/lib/progressQueue";
import { getChildRoster, rememberChildInRoster } from "@/lib/childRoster";
import type { Profile } from "@/lib/types";
import {
  pinLoginProfileFromProfile,
  pinLoginProfileFromRoster,
  type ChildSigninCredentials,
  type PinLoginProfile,
} from "@/features/pin-login";
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
  // Sat NÅR og KUN når vi bevidst viser picker uden en forælder-session
  // (Leverance B4, gren 3 ovenfor) — holdt adskilt fra `profiles` for at
  // undgå at overloade "null" med to betydninger ("henter stadig" vs.
  // "her er roster-kortene"). Ryddes så snart en rigtig profilliste
  // hentes, så en senere forælder-session altid vinder.
  const [rosterFallback, setRosterFallback] = useState<PinLoginProfile[] | null>(null);
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
    const own = await fetchOwnProfiles();
    setProfiles(own);
    if (own !== null) setRosterFallback(null);
  }, []);

  /** Barnet har bestået dyre-pinnen (eller profilen er ulåst) — ELLER en gyldig egen session blev genoptaget ved boot. */
  const onChildLoggedIn = useCallback((profile: Profile) => {
    // SIKKERHEDSKRITISK: den aktive identitet er nu barnets, ikke
    // forælderens (uanset om vi kom hertil via et frisk pin-login eller
    // en genoptaget session ved boot). En tidligere bestået forældre-port
    // gjaldt en anden identitet — den må IKKE overleve, ellers kunne
    // barnet gå picker → "🔒 Forælder" → parent_gate og springe lige ind
    // i dashboardet uden kodeord.
    gatePassed.current = false;
    setActiveChild(profile);
    // Stemmen følger profilen (ejer-godkendt): skriv ind i det eksisterende
    // voicePref-lager, så alle spil forbliver urørte.
    setVoicePref(profile.preferred_voice === "male" ? "male" : "female");
    // Enheds-lokal roster: husk/opdatér barnet ved HVERT login (frisk
    // hasPin retter enhver forældet cache automatisk) — grundlaget for
    // Leverance B4's roster-drevne picker.
    rememberChildInRoster({
      profileId: profile.id,
      displayName: profile.display_name,
      avatar: profile.avatar,
      hasPin: profile.pin_hash !== null,
    });

    void checkGuestMigration(profile.id).then((check) => {
      if (check.shouldOffer) {
        setMigrationOffer({ profile, lessonCount: check.guestLessonCount });
      } else {
        setView("child");
      }
    });
  }, []);

  // Boot + reaktion på login/logout (fx "log ud" inde i dashboardet).
  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const session = data.session;

      if (!session) {
        // Gren 3/4: ingen session — roster'en (tidligere login på DENNE
        // enhed) afgør om vi kan vise picker uden en forælder, eller om
        // det må være Landing (frisk enhed, del 5.2).
        const roster = getChildRoster();
        if (roster.length > 0) {
          setRosterFallback(roster.map(pinLoginProfileFromRoster));
          setView("picker");
        } else {
          setView("landing");
        }
        return;
      }

      // Gren 1/2: en session findes. Samme kald (`fetchOwnProfiles`)
      // virker for BÅDE en forælder (alle egne børn, `profiles_owner_all`)
      // OG et barn (kun sig selv, `profiles_child_select_own`) — RLS
      // afgør omfanget, ikke klienten.
      const own = await fetchOwnProfiles();
      if (cancelled) return;
      setProfiles(own);
      if (own !== null) setRosterFallback(null);

      const ownChild = own?.find((p) => p.auth_user_id === session.user.id) ?? null;
      if (ownChild) {
        // Gren 1: denne session ER barnets egen — genoptag direkte,
        // ingen picker, ingen pin (ejer-beslutning: mindst friktion).
        onChildLoggedIn(ownChild);
        return;
      }
      // Gren 2: forælder/redaktør/godkender-session — uændret adfærd.
      setView("picker");
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
  }, [loadProfiles, onChildLoggedIn]);

  // Leverance 1.1: tøm den offline-kø der måtte være liggende fra sidste
  // session (app-start), og igen hver gang enheden bliver online. Billigt
  // no-op når køen er tom — kører derfor uafhængigt af login-status.
  useEffect(() => startSyncEngine(), []);

  /**
   * Leverance B2 (udvidet i B4): pin'en er bekræftet af serveren
   * (child-signin). Skift den AKTIVE Supabase-session fra forælderens
   * (eller ingen) til barnets EGEN — signOut FØRST (eksplicit, jf. planens
   * del 7 spørgsmål 2: "log helt ud"), derefter verifyOtp med engangs-
   * tokenet. Fail-closed ved fejl: ingen session er bedre end en forkert
   * én.
   *
   * `profileId` er alt vi får ind (ikke et fuldt Profile-objekt) — kortet
   * kan have kommet fra enten forælderens fulde liste ELLER enheds-
   * roster'en (Leverance B4), som kun kender {id, navn, avatar, hasPin}.
   * Vi henter derfor den KANONISKE profil frisk under barnets egen,
   * nu-bekræftede session, uanset kilde.
   */
  const completeChildSignin = useCallback(
    async (profileId: string, credentials: ChildSigninCredentials) => {
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

      const freshProfiles = await fetchOwnProfiles();
      const own = freshProfiles?.find((p) => p.id === profileId) ?? null;
      if (!own) {
        // Uventet: pin'en var korrekt, men profilen kunne ikke genfindes
        // under barnets egen session (fx slettet i mellemtiden af en
        // forælder). Fail-closed frem for at gå videre med ufuldstændige
        // data.
        await supabase.auth.signOut();
        setProfiles(null);
        setActiveChild(null);
        setView("landing");
        return false;
      }

      setProfiles(freshProfiles);
      setRosterFallback(null);
      onChildLoggedIn(own);
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
        const wasChild = activeChild !== null;
        setActiveChild(null);

        if (wasChild) {
          // Barnets egen session kan (RLS) kun se sig selv — for at vise
          // søskende igen skal identiteten skiftes helt væk først, og
          // roster'en (enheds-cache, Leverance B4) tager over som
          // datakilde for kortene, uafhængigt af hvad der lige var aktivt.
          authTransitionInFlight.current = true;
          void supabase.auth.signOut().finally(() => {
            authTransitionInFlight.current = false;
            setProfiles(null);
            const roster = getChildRoster();
            setRosterFallback(roster.length > 0 ? roster.map(pinLoginProfileFromRoster) : null);
            setView("picker");
          });
          return;
        }

        if (profiles !== null) {
          // Forælderens session er stadig aktiv i denne fane — søskende
          // kendes allerede, ingen gen-hentning nødvendig.
          setView("picker");
          return;
        }

        // Ingen kendt liste, og ingen barne-session at rydde: tjek om en
        // forælder-session findes (uændret adfærd); ellers falder vi
        // tilbage på enheds-roster'en (B4), og kun i sidste ende Landing.
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            void loadProfiles();
            setView("picker");
            return;
          }
          const roster = getChildRoster();
          if (roster.length > 0) {
            setRosterFallback(roster.map(pinLoginProfileFromRoster));
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
    [loadProfiles, profiles, activeChild],
  );

  // Det picker'en reelt viser: forælderens fulde liste (mappet til det
  // lette PinLogin-format) hvis den findes, ellers roster-fallbacken
  // (Leverance B4), ellers intet endnu (genuint "henter …").
  const pickerProfiles = useMemo<PinLoginProfile[] | null>(() => {
    if (profiles !== null) return profiles.map(pinLoginProfileFromProfile);
    return rosterFallback;
  }, [profiles, rosterFallback]);

  return {
    view,
    profiles,
    pickerProfiles,
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
