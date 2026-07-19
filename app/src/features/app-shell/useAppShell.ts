/**
 * useAppShell — appens øverste state-maskine (ejer-godkendt demo
 * nour-app-skal-demo.html, milepælen "Barnets rejse → profilen").
 *
 * Delt-enhed-modellen (arkitektur-faktum fra RLS): profillisten og al
 * progress-skrivning kræver forælderens Supabase-session (`owner_account_id
 * = auth.uid()`). Barnets indgang forudsætter derfor at forælderen er
 * logget ind på enheden én gang; dyre-pinnen er "hvem er du"-porten mellem
 * søskende, ikke en kryptografisk grænse.
 *
 * Visninger:
 *   loading      — boot: supabase.auth.getSession()
 *   landing      — ingen session: "Log ind som forælder" / "Prøv uden konto"
 *   parent       — forældre-området (ParentAuth: login → samtykke → dashboard)
 *   picker       — børne-indgangen (PinLogin: profilvælger → dyre-pin)
 *   parent_gate  — adgangskode-port fra picker → parent (barnet må aldrig
 *                  kunne nå slette-knapperne)
 *   child        — lukket børne-tilstand: verdenskort + lektioner på profilen
 *   guest        — prøve-indgang: lokal-gem + venlig "gem dit lys"-opfordring
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { setVoicePref } from "@/lib/voicePref";
import type { Profile } from "@/lib/types";
import {
  checkGuestMigration,
  fetchOwnProfiles,
  migrateGuestProgress,
  verifyParentPassword,
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

  /** Barnet har bestået dyre-pinnen (eller profilen er ulåst). */
  const onChildLoggedIn = useCallback((profile: Profile) => {
    setActiveChild(profile);
    // Stemmen følger profilen (ejer-godkendt): skriv ind i det eksisterende
    // voicePref-lager, så alle spil forbliver urørte.
    setVoicePref(profile.preferred_voice === "male" ? "male" : "female");

    void checkGuestMigration(profile.id).then((check) => {
      if (check.shouldOffer) {
        setMigrationOffer({ profile, lessonCount: check.guestLessonCount });
      } else {
        setView("child");
      }
    });
  }, []);

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

  /** Forældre-porten: bekræft adgangskode, derefter forældre-området. */
  const submitGate = useCallback(async (password: string) => {
    setGateStatus("checking");
    const ok = await verifyParentPassword(password);
    if (ok) {
      gatePassed.current = true;
      setGateStatus("idle");
      setView("parent");
    } else {
      setGateStatus("wrong");
    }
  }, []);

  const goTo = useCallback(
    (target: Exclude<ShellView, "loading">) => {
      if (target === "parent_gate") setGateStatus("idle");
      if (target === "picker") {
        setActiveChild(null);
        // Børne-indgangen kræver en forælder-session (delt-enhed-modellen).
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
    [loadProfiles],
  );

  return {
    view,
    profiles,
    activeChild,
    migrationOffer,
    gateStatus,
    onChildLoggedIn,
    acceptMigration,
    declineMigration,
    submitGate,
    goTo,
  };
}
