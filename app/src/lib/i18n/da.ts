/**
 * da.ts — dansk kilde-sandhed for al UI-tekst (menuer, knapper, labels).
 *
 * VIGTIGT: dette er UI-CHROME-sprog (knapper, overskrifter, statusbeskeder),
 * IKKE læringsindhold. Det rører ALDRIG den pædagogiske dansk-dominans
 * (SKILL.md kerneviden 3) eller aqidah-muren — det er ren AI-tilladt
 * grænseflade-tekst, samme kategori som spil-tekst og akhlaq-historier.
 *
 * Struktur: ét navnerum pr. feature/skærm. Migreres skærm for skærm
 * (plan-platformsmodning.md §2.1) — nye navnerum tilføjes efterhånden som
 * flere skærme porteres, ikke alle på én gang.
 *
 * `ar.ts` er typet som `typeof da` — TypeScript fanger derfor en manglende
 * oversat nøgle som en typefejl ved `tsc --noEmit`, ikke først i produktion.
 */

export const da = {
  /** Genbrugelige strenge på tværs af skærme — undgår dublet-oversættelser. */
  common: {
    back: "Tilbage",
    somethingWrong: "Noget gik galt",
  },

  pinLogin: {
    /** Overskrift på profilvælgeren. */
    whoAreYou: "Hvem er du?",
    /** Tilbage-link fra pin-skærmen til profilvælgeren. */
    switchProfile: "← Skift profil",
    /** Overskrift på pin-skærmen med barnets navn. */
    greeting: (name: string) => `Hej ${name}! Vis din kode`,
    /** aria-label på selve kode-pladserne. */
    yourCode: "Din kode",
    /** Feedback: rate-limited, med opfordring til at hente en voksen. */
    waitWithAdult: (seconds: number) => `Vent lidt sammen med en voksen 🤝 (${seconds}s)`,
    /** Feedback: rate-limited, uden voksen-opfordring endnu. */
    waitAlone: (seconds: number) => `Vent lidt, og prøv igen … (${seconds}s)`,
    /** Feedback: forkert kode, gentagne fejl → hent en voksen. */
    tryAgainWithAdult: "Prøv igen sammen med en voksen 🤝",
    /** Feedback: forkert kode, soft-skin (3–6 år), blid tone. */
    wrongSoft: "Prøv igen! 🌙",
    /** Feedback: forkert kode, mid/teen-skin. */
    wrongOther: "Ikke helt — prøv igen",
    /** Feedback: profilen har endnu ingen auth-adgang aktiveret. */
    notProvisioned:
      "Denne profil er ikke helt klar endnu. Bed en voksen om at aktivere adgang i forældre-portalen.",
    /** Feedback: netværksfejl ved pin-tjek. */
    networkError: "Kunne ikke tjekke koden — prøv igen om lidt",
    /** Feedback: mens pin-koden tjekkes mod serveren. */
    checking: "Tjekker …",
    /** Velkomstoverskrift efter korrekt kode, med barnets navn. */
    welcome: (name: string) => `Velkommen, ${name}! ✨`,
  },

  lessonPicker: {
    fetchError: (message: string) => `Kunne ikke hente lektionerne: ${message}`,
    loading: "Henter lektioner …",
    recommended: "Anbefalet",
  },

  tegnBogstavet: {
    lettersNotFound: "Ingen bogstaver fundet.",
    loadingLetters: "Henter bogstaver …",
    roundDoneHeading: (skin: "soft" | "mid" | "teen"): string =>
      skin === "soft" ? "Alle bogstaver tændt!" : skin === "mid" ? "Flot skrevet!" : "Runde færdig",
    cleanStrokes: (clean: number, total: number) => `${clean}/${total} rene streger`,
    xpEarned: (xp: number) => `+${xp} XP`,
    savingProgress: "Gemmer fremskridt …",
    progressSaved: "Fremskridt gemt",
    progressQueued: "Dit lys gemmes, når du er online igen",
    progressError: "Kunne ikke gemmes lige nu — prøver igen",
    traceAgain: "Tegn igen",
    traceLetter: (name: string) => `Tegn ${name}!`,
    hearAgain: "Hør bogstavet igen",
    precision: (pct: number) => `Præcision: ${pct} %`,
    stayInsideHint: "Prøv at blive inde i bogstavet — så vokser lyset hurtigere ✨",
    stepDoneSoft: (name: string) => `${name} lyser nu! ⭐`,
    stepDoneClean: (name: string) => `Ren streg — flot ${name}!`,
    stepDoneDefault: (name: string) => `${name} er tændt!`,
    next: "Videre",
  },
};

export type Dictionary = typeof da;
