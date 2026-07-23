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

  matchPar: {
    lightInValley: "Lys i dalen",
    loadingLanterns: "Tænder lanterner …",
    /** Fallback når fejlbeskeden fra Supabase mangler (fx for få ord i databasen). */
    tooFewWords: "For få ord i databasen til at bygge par.",
    arabicCardLabel: "Arabisk kort",
    danishCardLabel: (word: string) => `Dansk kort: ${word}`,
    registerFusha: "fusha",
    registerEveryday: "hverdag",
    valleyGlows: "Dalen lyser! ✦",
    statsSoft: (totalPairs: number) => `Alle ${totalPairs} lanterner er tændt`,
    statsMid: (totalPairs: number, xp: number, bestCombo: number) =>
      `${totalPairs} par · ${xp} XP · bedste stime ${bestCombo}`,
    statsTeen: (totalPairs: number, moves: number, precision: number, xp: number) =>
      `${totalPairs} par på ${moves} træk · præcision ${precision}% · ${xp} XP`,
    savingProgress: "Gemmer fremskridt …",
    progressSaved: "Fremskridt gemt ✓",
    progressQueued: "Dit lys gemmes, når du er online igen",
    progressError: "Kunne ikke gemmes lige nu — prøver igen",
    newGame: "Nyt spil",
    playAgain: "Spil igen",
  },

  lytOgFind: {
    loadingLetters: "Henter bogstaver …",
    /** Fallback når fejlbeskeden fra Supabase mangler. */
    noLettersFound: "Ingen bogstaver fundet i databasen.",
    /** aria-label på fremskridts-prikkerne (soft/mid). */
    questionOf: (current: number, total: number) => `Spørgsmål ${current} af ${total}`,
    hearAgain: "Hør lyden igen",
    syntheticVoiceNotice: "Syntetisk stemme — udskiftes med rigtig lyd senere",
    audioNotRecorded: "Lyd ikke optaget endnu",
    feedbackSoft: "Flot fundet! ⭐",
    feedbackMid: (danish: string) => `Det var ${danish} — flot klaret!`,
    feedbackTeen: (danish: string) => `Rigtigt svar: ${danish}`,
    next: "Videre",
    roundDoneHeading: (skin: "soft" | "mid" | "teen"): string =>
      skin === "soft" ? "Landet fik mere lys!" : skin === "mid" ? "Godt klaret!" : "Runde færdig",
    correctFirstTry: (correct: number, total: number) => `${correct}/${total} rigtige i første forsøg`,
    xpEarned: (xp: number) => `+${xp} XP`,
    savingProgress: "Gemmer fremskridt …",
    progressSaved: "Fremskridt gemt",
    progressQueued: "Dit lys gemmes, når du er online igen",
    progressError: "Kunne ikke gemmes lige nu — prøver igen",
    playAgain: "Spil igen",
  },

  historierBjerge: {
    backToStories: "Til fortællingerne",
    backToMap: "Tilbage til kortet",
    loadingStories: "Henter fortællinger …",
    /** Fejlbesked fra engine.ts's fetchStoriesForAge (parametriseret, ikke useT direkte i en ikke-hook-funktion). */
    fetchError: "Fortællingerne kunne ikke hentes lige nu. Prøv igen.",
    emptyStateText:
      "Historiernes Bjerge venter stadig på sin første fortælling. Kom snart tilbage — lyset er ved at blive tændt.",
    sourceVerified: "Kilde-verificeret",
    sourceLabel: (ref: string) => `Kilde: ${ref}`,
    quizHeading: "Hvad husker du?",
    quizIntroSoft: "Prøv at trykke — der er ikke noget forkert svar her.",
    quizIntroOther: "Vælg det du husker fra fortællingen.",
    quizFeedbackSoft: "Godt tænkt! ✨",
    quizFeedbackCorrect: "Ja, sådan var det! 🌟",
    quizFeedbackWrong: "Tæt på — det rigtige svar er fremhævet ovenfor.",
  },

  lektion: {
    fallbackTitle: "Lektion",
    backToMap: "Til kortet",
    stepsLit: (lit: number, total: number) => `Trin ${lit} af ${total} tændt`,
    loadingLanterns: "Tænder lanterner …",
    /** Fallback-fejlbeskeder når Supabase intet returnerer. */
    lessonNotFound: "Lektionen blev ikke fundet.",
    lessonHasNoSteps: "Lektionen har ingen trin endnu.",
    stepOf: (current: number, total: number, title: string) =>
      `Trin ${current} af ${total} · ${title}`,
    introStepsCount: (count: number) => `${count} trin · stigende sværhedsgrad`,
    introStopAnytime: "Du kan stoppe når som helst — alt gemmes",
    resumeAt: (step: number) => `Fortsæt hvor du slap · trin ${step} ✦`,
    startLesson: "Start lektionen ✦",
    startOver: "Start forfra",
    softIntroHint: "Korte, blide trin — i barnets tempo",
    stepLitOf: (current: number, total: number) => `Trin ${current} af ${total} tændt ✦`,
    xpThisSession: (xp: number) => `★ ${xp} XP i denne session`,
    nextLabel: "Næste:",
    next: "Videre",
    stopHereSaved: "Stop her — alt er gemt",
    lessonGlows: "Lektionen lyser! ✦",
    allStepsDone: (total: number) => `Alle ${total} trin gennemført`,
    xpSuffix: (xp: number) => ` · ★ ${xp} XP`,
    yoursNow: "er dine nu — dalen har fået mere lys.",
    playAgain: "Spil igen",
    savingProgress: "Gemmer fremskridt …",
    progressSaved: "Fremskridt gemt ✓",
    progressQueued: "Dit lys gemmes, når du er online igen",
    progressError: "Kunne ikke gemmes lige nu — prøver igen",
  },
};

export type Dictionary = typeof da;
