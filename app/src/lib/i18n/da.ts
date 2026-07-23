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

  errorScreen: {
    copy: {
      soft: {
        title: "Uh oh! Lyset blinkede 🏮",
        body: "Det var ikke dig. Tryk på det store lys for at prøve igen.",
        cta: "Prøv igen ✨",
        exit: null as string | null,
      },
      mid: {
        title: "Der gik noget galt for et øjeblik",
        body: "Det er ikke din skyld. Dit fremskridt er gemt — prøv igen.",
        cta: "Prøv igen",
        exit: "Tilbage til kortet" as string | null,
      },
      teen: {
        title: "Uventet fejl",
        body: "Der opstod en teknisk fejl. Du kan roligt prøve igen — dit fremskridt er gemt undervejs.",
        cta: "Prøv igen",
        exit: "Tilbage til kortet" as string | null,
      },
    },
  },

  /**
   * Samtykketeksten er ejer-godkendt på dansk (2026-07-19, plan-samtykke-flow.md).
   * Den arabiske oversættelse er et UDKAST (ligesom resten af ar.ts) og bør
   * have samme to-trins godkendelse som originalen: ejerens ordlyd-godkendelse
   * OG juridisk gennemsyn før offentlig lancering — Claude er ikke jurist.
   */
  consent: {
    heading: "Samtykke til Nour",
    subheading: "Før vi opretter din første børneprofil, skal vi lige have din tilladelse.",
    whatWeStoreHeading: "Det vi gemmer om dit barn",
    storeNickname: "Kaldenavn (ikke fulde navn)",
    storeBirthYear: "Fødselsår (kun til rette indholdsniveau)",
    storeAvatar: "Valgt avatar",
    storeProgress: "Fremskridt i lektionerne",
    neverAskText:
      "Vi beder aldrig om adresse, telefonnummer, billeder eller e-mail på barnet. Barnet opretter aldrig selv en konto.",
    legalBasisHeading: "Retsgrundlag",
    legalBasisText:
      "Vi behandler oplysningerne, fordi du som forælder giver samtykke. Du kan altid trække det tilbage.",
    whereDataLivesHeading: "Hvor data ligger",
    whereDataLivesText: "Hos Supabase i EU (Frankfurt). Ingen data forlader EU.",
    noAdsHeading: "Ingen reklamer, intet sporing",
    noAdsText: "Nour viser aldrig reklamer og sporer ikke dit barns adfærd til markedsføring.",
    rightsHeading: "Dine rettigheder",
    rightsText:
      "Du kan altid se, rette eller slette dit barns profil. Sletning fjerner al data permanent med ét klik — kan ikke fortrydes.",
    legalWarning:
      "⚠️ Dette er et udkast udarbejdet ud fra projektets principper — ikke juridisk rådgivning. Bør gennemgås juridisk før offentlig lancering.",
    versionLabel: (version: string) => `Version: ${version}`,
    checkboxLabel:
      "Jeg er barnets forælder eller værge, og jeg giver samtykke som beskrevet ovenfor.",
    registering: "Registrerer …",
    submitButton: "Jeg giver samtykke og fortsætter",
    submitError: "Kunne ikke registrere samtykket. Tjek din forbindelse og prøv igen.",
  },

  opretProfil: {
    heading: "Opret barneprofil",
    subtitleAbout: "Fortæl os lidt om dit barn",
    subtitlePin: (name: string) => `Dyre-kode til ${name} (valgfrit)`,
    subtitleConfirm: "Vælg de samme dyr igen",
    subtitleSummary: "Tjek at alt passer",
    nicknameLabel: "Kaldenavn",
    nicknamePlaceholder: "fx Ali eller Zainab",
    birthYearLabel: "Fødselsår",
    ageSuffix: (age: number) => `${age} år`,
    avatarLabel: "Avatar",
    avatarNote: "· kan skiftes senere",
    avatarAriaLabel: (n: number) => `Avatar ${n}`,
    voiceLabel: "Oplæser-stemme",
    voiceFemale: "🎀 Habibah",
    voiceFemaleSub: "kvindestemme",
    voiceMale: "🎩 Ahmed",
    voiceMaleSub: "mandestemme",
    privacyNote:
      "Vi gemmer kun kaldenavn, fødselsår og avatar — aldrig fulde navne, adresser eller e-mails på børn.",
    next: "Videre",
    animalAriaLabel: (n: number) => `Dyr ${n}`,
    pinHint: (min: number, max: number, name: string) =>
      `Tryk på ${min}–${max} dyr i den rækkefølge, der skal være ${name}s kode.`,
    clear: "Ryd",
    nextConfirmCode: "Videre — bekræft koden",
    skipNoPin: "Spring over — ingen kode nu",
    confirmMismatch: "Hov — det var ikke helt de samme dyr. Prøv igen 💛",
    confirmMatch: "Perfekt — koden passer! ✨",
    confirmHint: (length: number) =>
      `Bekræft koden ved at trykke på de samme ${length} dyr i samme rækkefølge.`,
    tryAgain: "Prøv igen",
    backChooseNewCode: "Tilbage — vælg ny kode",
    sumNickname: "Kaldenavn",
    sumBirthYear: "Fødselsår",
    sumAvatar: "Avatar",
    sumVoice: "Stemme",
    sumPin: "Dyre-kode",
    sumBirthYearValue: (year: number, age: number) => `${year} · ${age} år`,
    sumPinNone: "Ingen (kan tilføjes senere)",
    creating: "Opretter…",
    createProfile: "Opret profil",
    backAndEdit: "Tilbage og ret",
    lanternLit: (name: string) => `${name}s lanterne er tændt! 🏮`,
    profileCreatedSentence: (withPin: boolean): string =>
      withPin ? "Profilen er oprettet med dyre-kode." : "Profilen er oprettet.",
    canLoginSentence: (name: string, withPin: boolean) =>
      withPin
        ? `${name} kan nu logge ind fra børne-skærmen med sin kode.`
        : `${name} kan nu logge ind fra børne-skærmen.`,
    createAnother: "Opret endnu en profil",
    /** Fejlbeskeder fra engine.ts (parametriseret, ikke useT direkte i ikke-hook-funktioner). */
    errorEmptyName: "Skriv et kaldenavn først.",
    pinSaveFailed:
      "Profilen er oprettet, men dyre-koden kunne ikke gemmes. Prøv at sætte den igen fra forældre-oversigten.",
    errorGeneric: "Noget gik galt. Tjek din forbindelse og prøv igen.",
    errorRls: "Du har ikke adgang til at oprette denne profil. Log ud og ind igen, og prøv så.",
    errorBirthYear: "Fødselsåret ligger uden for det tilladte interval.",
    errorNetwork: "Ingen forbindelse. Tjek internettet og prøv igen.",
    errorFallback: "Profilen kunne ikke oprettes. Prøv igen om lidt.",
  },

  appShell: {
    voiceLabelFemale: "🔊 Habibah ♀",
    voiceLabelMale: "🔊 Ahmed ♂",
    loadingLanterns: "Tænder lanternerne …",
    backToChildEntry: "‹ Til børne-indgangen",
    loadingProfiles: "Henter profiler …",
    noProfilesHeading: "Ingen børneprofiler endnu",
    noProfilesText:
      "Åbn forældre-området for at oprette den første profil — så tændes barnets egen lanterne.",
    parentLockButton: "🔒 Forældre",
    back: "‹ Tilbage",
    adultsOnly: "Kun for voksne",
    parentLoginLabel: "Log ind som forælder",
    parentGateIntro:
      "Indtast din e-mail og adgangskode for at åbne forældre-området. Her kan man oprette og slette børneprofiler.",
    emailPlaceholder: "E-mail",
    passwordPlaceholder: "Adgangskode",
    wrongCredentials: "Forkert e-mail eller adgangskode. Prøv igen.",
    checking: "Tjekker …",
    openParentArea: "Åbn forældre-området",
    tagline: "Lær arabisk — og lad lyset vokse",
    tryWithoutAccount: "Prøv uden konto",
    guestHint:
      "Uden konto gemmes fremskridt kun på denne enhed. En forælder-konto gemmer barnets lys sikkert.",
    switchUser: "Skift bruger",
    guestBannerBold: "Gem dit lys.",
    guestBannerText:
      " Lige nu husker kun denne enhed dit fremskridt. Bed en voksen oprette en gratis forælder-konto — så følger lyset med dig.",
    guestCreateCta: "Opret →",
    ageGroupAriaLabel: "Alder",
    backToLanding: "‹ Til forsiden",
    migrationHeading: "🏮 Der er lys gemt på denne enhed",
    migrationIntro: "Nogen har spillet som gæst her og samlet lys i",
    migrationLessonPhrase: (count: number) => `${count} lektion${count === 1 ? "" : "er"}`,
    migrationQuestionLead: ". Skal",
    migrationQuestionTail: "tage det med ind på sin profil?",
    migrationAccept: "Ja — tag lyset med ✨",
    migrationDecline: "Nej, det var ikke mig",
    migrationHint:
      "Vælger du nej, bliver gæste-lyset på enheden og kan tages med af en anden profil senere.",
  },
};

export type Dictionary = typeof da;
