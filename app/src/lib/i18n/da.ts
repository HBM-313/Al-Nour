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
    /** aria-label på DA/AR-sprogskifteren (forælder/admin-UI). */
    switcherAriaLabel: "Sprog",
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

  historieVaerksted: {
    tablistAriaLabel: "Historie-værksted",
    tabStories: "Fortællinger",
    tabNew: "Ny fortælling",

    wallNoteBold: "Muren gælder her — strengere end noget andet sted:",
    wallNoteIntro:
      "AI skriver aldrig en fortælling. Kun godkendt kildetekst fra autoriserede kilder må indsættes.",
    wallNoteApprover: "Som godkender kan du kilde-verificere og udgive.",
    wallNoteEditor:
      "Som redaktør kan du oprette og redigere kladder — kun en godkender kan kilde-verificere og udgive dem.",
    wallNoteSuffix: "De hellige repræsenteres altid kun som lys.",

    loadingStories: "Henter fortællinger …",

    searchPlaceholder: "Søg på titel…",
    searchAriaLabel: "Søg i fortællinger",
    statusGroupAriaLabel: "Status",
    statusAll: "Alle",
    statusDraft: "Kladder",
    statusVerified: "Verificeret",
    statusPublished: "Udgivet",
    emptyList: "Ingen fortællinger matcher. Tryk “Ny fortælling” for at oprette en kladde.",

    storyStatusPublished: "Udgivet — lyser i Historiernes Bjerge",
    storyStatusVerified: "Kilde-verificeret — klar til udgivelse",
    storyStatusDraft: "Kladde",
    ageAndLevel: (min: number, max: number, level: number | null) =>
      `alder ${min}–${max} · niveau ${level ?? "–"}`,
    sourceVerifiedBadge: (ref: string | null) => `✓ Kilde-verificeret${ref ? ` · ${ref}` : ""}`,
    draftBadge: "Kladde — endnu ikke verificeret",

    verifySourceButton: "Markér kilde-verificeret",
    publishButton: "Tænd lyset (udgiv)",
    removeVerificationButton: "Fjern verifikation",
    unpublishButton: "Sluk lyset (afpublicér)",
    editButton: "Redigér",
    editLockedTitle: "Kun en godkender kan redigere en verificeret/udgivet fortælling",
    lockHint:
      "🔒 Kilde-verifikation og udgivelse er kun mulig for en godkender — databasen afviser alt andet.",

    formHeadingEdit: "Redigér fortælling",
    formHeadingNew: "Ny fortælling",
    titleDaLabel: "Titel (dansk)",
    titleDaPlaceholder: "Fortællingens danske titel",
    titleArLabel: "Titel (arabisk)",
    sourceRefLabel: "Kildehenvisning",
    sourceRefPlaceholder: "Fx bog, side, autoriseret kilde",
    sourceRefHint: "Obligatorisk — databasen afviser en aqidah-række uden kilde.",
    bodyDaLabel: "Godkendt kildetekst (dansk)",
    bodyDaPlaceholder: "Indsæt den allerede godkendte kildetekst her — skriv ikke ny aqidah selv",
    ageVariantsSummary: "Aldersvarianter (valgfrit — simpel / mellem / dyb)",
    simpleAgeLabel: "Simpel (3–6 år)",
    mediumAgeLabel: "Mellem (7–10 år)",
    deepAgeLabel: "Dyb (11–14 år)",
    ageRangeLabel: "Aldersspænd",
    levelLabel: "Niveau (sprog)",

    quizSectionTitle: '🧠 "Hvad husker du?" — quiz pr. aldersgruppe',
    quizHint:
      "Samme mur som teksten ovenfor. Fælles vises til alle aldre, medmindre du udfylder en aldersvariant — så får netop den gruppe sin egen quiz (samme princip som tekstens simpel/mellem/dyb). Hvert spørgsmål: mindst 2 svar, præcis ét rigtigt.",
    quizVariantTablistAriaLabel: "Quiz-variant",
    quizVariantLabel: (key: "faelles" | "simpel" | "mellem" | "dyb"): string =>
      key === "faelles"
        ? "Fælles"
        : key === "simpel"
          ? "Simpel (3–6)"
          : key === "mellem"
            ? "Mellem (7–10)"
            : "Dyb (11–14)",
    quizEmptyGeneric: "Ingen spørgsmål i denne variant endnu — helt valgfrit.",
    quizEmptyAgeVariantHint: "Uden spørgsmål her får aldersgruppen den fælles quiz.",
    quizEmptyFaellesHint: "Tryk “+ Tilføj spørgsmål” for at starte.",
    questionLabel: (n: number) => `Spørgsmål ${n}`,
    removeQuestionAria: (n: number) => `Fjern spørgsmål ${n}`,
    questionDaLabel: "Spørgsmål (dansk)",
    questionPlaceholder: "Fx: Hvad husker du bedst fra fortællingen?",
    answerOptionsHint: "Svarmuligheder — vælg det ét rigtige svar med prikken:",
    markCorrectAria: (n: number) => `Markér svarmulighed ${n} som rigtig`,
    optionPlaceholder: (n: number) => `Svarmulighed ${n}`,
    removeOptionAria: (n: number) => `Fjern svarmulighed ${n}`,
    addOption: "+ Svarmulighed",
    addQuestion: "+ Tilføj spørgsmål",

    worldLabel: "Verden",
    worldLocked: "🔒 Historiernes Bjerge — låst for aqidah",
    sacredLabel: "De hellige",
    sacredLocked: "🔒 Kun som lys — låst i databasen (sacred_representation = 'light')",
    sacredNote:
      "Profeten ﷺ og de 12 imamer afbildes aldrig som skikkelse. Illustrationer viser lys, kalligrafi og miljø.",

    saving: "Gemmer…",
    saveDraft: "Gem kladde",
    cancel: "Annullér",

    /** Formular-validering (StoryForm.onSave). */
    validationTitleRequired: "Skriv den danske titel.",
    validationSourceRequired:
      "Kildehenvisning er obligatorisk for aqidah — databasen afviser oprettelsen uden den.",
    validationBodyRequired: "Indsæt den godkendte kildetekst.",
    quizQuestionMissingText: (variantLabel: string, n: number) =>
      `${variantLabel}: spørgsmål ${n} mangler tekst.`,
    quizQuestionNeedsTwoOptions: (variantLabel: string, n: number) =>
      `${variantLabel}: spørgsmål ${n} skal have mindst 2 svarmuligheder.`,
    quizQuestionEmptyOption: (variantLabel: string, n: number) =>
      `${variantLabel}: spørgsmål ${n} har en tom svarmulighed.`,
    quizQuestionNeedsOneCorrect: (variantLabel: string, n: number) =>
      `${variantLabel}: spørgsmål ${n} skal have præcis ét rigtigt svar.`,

    /** Fejlbeskeder fra engine.ts (parametriseret fra useHistorieVaerksted.ts, ikke useT direkte i ikke-hook-funktioner). */
    fetchError: "Fortællingerne kunne ikke hentes. Prøv igen.",
    insertWallRejected: (detail: string) => `Muren afviste oprettelsen: ${detail}`,
    updateFailed: (detail: string) => `Ændringen kunne ikke gemmes: ${detail}`,
    updateWallRejected:
      "Muren afviste ændringen: fortællingen er allerede kilde-verificeret af en godkender og kan ikke længere redigeres af en redaktør.",
    verifyWallRejected: (detail: string) => `Muren afviste verifikationen: ${detail}`,
    unverifyFailed: (detail: string) => `Ændringen kunne ikke gemmes: ${detail}`,
    publishWallRejected: (detail: string) => `Muren afviste udgivelsen: ${detail}`,

    /** Notice-beskeder fra useHistorieVaerksted.ts. */
    changesSaved: "Ændringerne er gemt.",
    draftSavedNotice: (title: string) =>
      `„${title}" er gemt som kladde. En godkender kan nu kilde-verificere den.`,
    verifiedNotice: (title: string) => `„${title}" er kilde-verificeret — klar til udgivelse.`,
    unverifiedNotice: (title: string) => `Verifikationen af „${title}" er fjernet.`,
    publishedNotice: (title: string) => `„${title}" lyser nu i Historiernes Bjerge 🏔️`,
    unpublishedNotice: (title: string) => `„${title}" er ikke længere synlig for børn.`,
  },

  /**
   * WorldMap — bevidst IKKE migreret: "Nour-landet"-overskriften (dual-
   * sprog h2 med både dansk og arabisk vist samtidig) og de tre region-
   * navne i selve SVG-kortet (Bogstavernes Dal / Historiernes Bjerge /
   * Hverdagshaven) — matcher præcedens fra historierBjerge/matchPar: faste
   * bilingvale overskrifter og universets egennavne oversættes ikke.
   */
  worldMap: {
    noLessonsFound: "Ingen lektioner fundet.",
    lightInTheLand: "Lys i landet",
    waking: "Landet vågner …",
    mapAriaLabel: "Kort over Nour-landet: syv lanterner i Bogstavernes Dal",
    mountainsAriaOpen: "Historiernes Bjerge — åbn fortællinger",
    mountainsAriaSleeping: "Historiernes Bjerge — vågner i fase 2",
    mountainsToast: "Historiernes Bjerge — fortællinger venter her (fase 2)",
    gardenAriaSleeping: "Hverdagshaven — vågner i fase 2",
    gardenToast: "Hverdagshaven — gode handlinger får ting til at gro (fase 2)",
    lessonLabel: (order: number, title: string) => `Lektion ${order}: ${title}`,
    lessonDoneSuffix: " — fuldført",
    lessonStartedSuffix: (lit: number, total: number) => ` — ${lit} af ${total} trin tændt`,
    allDoneText: "Hele dalen lyser ✦ Bjergene og haven vågner i fase 2 …",
  },

  parentAuth: {
    checkingLogin: "Tjekker login …",

    signupHeading: "Opret forælderkonto",
    loginHeading: "Velkommen tilbage",
    signupSubtitle: "Opret en konto for at tilføje dine børn til Nour-landet.",
    loginSubtitle: "Log ind for at følge dine børns rejse gennem Nour-landet.",
    loginTab: "Log ind",
    signupTab: "Opret konto",
    emailLabel: "E-mail",
    emailPlaceholder: "din@email.dk",
    passwordLabel: "Adgangskode",
    passwordMinHint: (min: number) => `Mindst ${min} tegn.`,
    confirmPasswordLabel: "Gentag adgangskode",
    submitCreating: "Opretter …",
    submitLoggingIn: "Logger ind …",
    submitCreate: "Opret konto",
    submitLogin: "Log ind",
    errorInvalidEmail: "Indtast en gyldig e-mailadresse.",
    errorPasswordTooShort: (min: number) => `Adgangskoden skal være mindst ${min} tegn.`,
    errorPasswordMismatch: "Adgangskoderne er ikke ens.",
    errorPasswordRequired: "Indtast din adgangskode.",

    confirmEmailHeading: "Bekræft din e-mail",
    confirmEmailBody: "Vi har sendt et bekræftelseslink til din e-mail. Klik på linket, og log derefter ind.",
    backToLogin: "Tilbage til login",

    signOutInstead: "Log ud i stedet",
    loggedInHeading: "Du er logget ind",
    portalAriaLabel: "Portal",
    tabChildren: "Børn",
    tabWorkshop: "Værkstedet",
    tabStories: "Historier",
    signOut: "Log ud",
    forgetDevice: "Glem denne enhed",
    forgetDeviceDone: "Denne enheds gemte børneliste er glemt.",
    forgetDeviceHint:
      "Rydder børnenes navne/billeder, som er gemt lokalt på denne enhed til hurtigere login.",
    deleteAccountLink: "Slet min konto",

    accountDeletedHeading: "Din konto er slettet",
    accountDeletedBody:
      "Din konto og alt tilhørende data — børneprofiler, fremskridt og lys — er slettet permanent. Tak fordi du brugte Nour.",
    close: "Luk",

    deleteDialogAriaLabel: "Slet din konto",
    deleteExplainHeading: "Slet din konto?",
    deleteExplainPrefix: "Dette sletter ",
    deleteExplainBold: "alt permanent",
    deleteExplainSuffix: (email: string) =>
      `: din konto (${email}), alle dine børns profiler, alt deres fremskridt og lys, og alle dyre-koder.`,
    deleteIrreversiblePrefix: "Det kan ",
    deleteIrreversibleBold: "ikke fortrydes",
    deleteIrreversibleSuffix: " — der er ingen fortrydelsesperiode. Sletningen sker med det samme.",
    deleteConfirmContinue: "Ja, jeg forstår — fortsæt",
    cancel: "Fortryd",
    confirmPasswordHeading: "Bekræft med din adgangskode",
    confirmPasswordBody: "Indtast din adgangskode for at slette kontoen for altid.",
    passwordPlaceholder: "Adgangskode",
    deleteFailedFallback: "Sletning fejlede. Prøv igen.",
    deleting: "Sletter…",
    deleteForever: "Slet min konto for altid",

    /** Fejlbeskeder fra engine.ts (parametriseret fra useParentAuth.ts, ikke useT direkte i ikke-hook-funktioner). */
    authWrongCredentials: "Forkert e-mail eller adgangskode.",
    authAlreadyRegistered: "Denne e-mail er allerede registreret. Prøv at logge ind i stedet.",
    authPasswordTooWeak: "Adgangskoden er for kort eller for simpel. Prøv mindst 8 tegn.",
    authRateLimited: "For mange forsøg lige nu — vent et øjeblik og prøv igen.",
    authInvalidEmailFormat: "Denne e-mailadresse ser ikke gyldig ud.",
    authGenericError: "Der skete en fejl. Prøv igen om lidt.",
    accountSetupFailed: "Kontoen blev oprettet, men kunne ikke sættes op. Prøv at logge ind igen.",
    connectionError: "Kunne ikke oprette forbindelse. Tjek din internetforbindelse.",
    loginFailed: "Login lykkedes ikke. Prøv igen.",
    accountFetchFailed: "Kunne ikke hente din konto. Prøv igen.",
    deleteAccountFailed: "Kontoen kunne ikke slettes. Prøv igen, eller kontakt os hvis det gentager sig.",
    wrongPassword: "Forkert adgangskode.",
  },

  dashboard: {
    backToOverview: "Tilbage til oversigten",
    loadingChildren: "Henter børn…",
    noChildrenLine1: "Ingen børneprofiler endnu.",
    noChildrenLine2: "Opret den første og tænd en lanterne 🏮",
    createProfileButton: "+ Opret barneprofil",

    ageSuffix: (age: number) => `${age} år`,
    pinSet: "🔑 kode sat",
    pinNotSet: "ingen kode",
    voiceFemale: "🎀 Habibah",
    voiceMale: "🎩 Ahmed",
    ownAccess: "👤 egen adgang",
    activating: "Aktiverer…",
    activateAccess: "Aktivér egen adgang →",

    toggleProgressHide: "Skjul",
    toggleProgressShow: "Fremskridt",
    pinButton: "Dyre-kode",
    deleteButton: "Slet",

    loadingProgress: "Henter fremskridt…",
    progressFetchError: "Fremskridt kunne ikke hentes. Prøv at folde ud igen.",
    notStartedYet: (childName: string) =>
      `${childName} er ikke begyndt endnu — rejsen venter i Bogstavernes Dal ✨`,
    inProgressLabel: "I gang med",
    inProgressValue: (orderIndex: number, step: number, total: number) =>
      `Lektion ${orderIndex} · trin ${step}/${total}`,
    completedLessonsLabel: "Fuldførte lektioner",
    completedLessonsValue: (count: number) => `${count} af 7`,
    totalXpLabel: "Lys samlet (XP)",
    totalXpValue: (xp: number) => `${xp} ✨`,
    streakLabel: "Streak",
    streakValue: (days: number) => `${days} dage 🔥`,

    deleteDialogAriaLabel: (name: string) => `Slet ${name}s profil`,
    deleteHeading: (name: string) => `Slet ${name}s profil?`,
    deleteExplainPrefix: "Dette sletter ",
    deleteExplainBold: "alt permanent",
    deleteExplainMiddle: ": profilen, alt fremskridt, XP og dyre-koden. Det kan ",
    deleteExplainBold2: "ikke fortrydes",
    deleteExplainSuffix: ".",
    deleteGdprNote: "Sådan overholder Nour din ret til sletning (GDPR) — ét klik, alt væk.",
    deleteConfirmButton: (name: string) => `Ja — slet alt om ${name}`,
    deleting: "Sletter…",
    cancel: "Fortryd",

    pinDialogAriaLabel: (name: string) => `Dyre-kode til ${name}`,
    pinHeadingChange: "Skift",
    pinHeadingSet: "Sæt",
    pinHeadingSuffix: (name: string) => `${name}s dyre-kode`,
    animalAriaLabel: (n: number) => `Dyr ${n}`,
    pinSaveFailed: "Koden kunne ikke gemmes. Tjek forbindelsen og prøv igen.",
    pinChooseHint: (min: number, max: number) => `Tryk på ${min}–${max} dyr i rækkefølge.`,
    pinMismatch: "Hov — ikke helt de samme dyr. Prøv igen 💛",
    pinMatch: "Perfekt — koden passer! ✨",
    pinConfirmHint: "Bekræft ved at vælge de samme dyr igen.",
    pinContinueConfirm: "Videre — bekræft",
    tryAgain: "Prøv igen",
    saving: "Gemmer…",
    saveCode: "Gem koden",

    /** D2 — læringstal: spil-tællere oversat til noget en forælder kan bruge. */
    learningHeading: (name: string) => `Hvad ${name} kan`,
    learningLettersLabel: "Bogstaver",
    learningWordsLabel: "Ord",
    learningCount: (known: number, total: number) => `${known} af ${total}`,
    learningEmpty: (name: string) =>
      `I er lige startet — kom tilbage her, når ${name} har øvet et par gange, så kan du se hvilke bogstaver og ord der sidder fast.`,
    learningShowLetters: "Se hvilke bogstaver",
    learningHideLetters: "Skjul bogstaverne",
    strugglesHeading: (name: string) => `Her øver ${name} stadig`,
    /** Begge bogstaver i samme rasm-gruppe er svage — vi kan ærligt sige "driller begge". */
    struggleLetterPair: (letter: string, others: string[]) =>
      `${letter} og ${others.join(", ")} driller begge — de har samme grundform, og kun prikkerne adskiller dem. Skriv dem ved siden af hinanden og tæl prikkerne sammen.`,
    /** Kun ét bogstav er svagt: sig hvad det LIGNER, påstå ikke en forveksling vi ikke kan se i tællerne. */
    struggleLetterAlone: (letter: string, nameDa: string, similar: string[]): string =>
      similar.length > 0
        ? `${letter} (${nameDa}) sidder ikke helt endnu. Det ligner ${similar.join(", ")} — læg mærke til prikkerne sammen.`
        : `${letter} (${nameDa}) sidder ikke helt endnu. Lidt mere øvelse løser det.`,
    struggleWord: (wordAr: string, translit: string, wordDa: string) =>
      `${wordAr} (${translit} — ${wordDa}) er stadig svært. Prøv at sige ordet højt sammen i løbet af dagen.`,
    fetchLearningError: "Læringstallene kunne ikke hentes. Prøv igen.",

    /** Fejlbeskeder fra engine.ts (parametriseret fra useDashboard.ts, ikke useT direkte i ikke-hook-funktioner) + toasts. */
    fetchChildrenError: "Børnene kunne ikke hentes. Prøv igen.",
    fetchProgressError: "Fremskridt kunne ikke hentes. Prøv igen.",
    activateAccessError: "Adgang kunne ikke aktiveres. Tjek at du er logget ind, og prøv igen.",
    unexpectedResponse: "Uventet svar. Prøv igen.",
    deleteProfileError: "Profilen kunne ikke slettes. Prøv igen.",
    deleteFailedToast: "Sletning fejlede",
    profileDeletedToast: (name: string) => `${name}s profil og al data er slettet`,
    accessAlreadyActiveToast: (name: string) => `${name}s adgang var allerede aktiveret`,
    accessActivatedToast: (name: string) => `${name}s egen adgang er aktiveret 🔑`,
    pinSavedToast: (name: string) => `${name}s dyre-kode er gemt 🔑`,
    lanternLitToast: (name: string) => `${name}s lanterne er tændt 🏮`,
  },

  /**
   * VokabVaerksted — bevidst IKKE oversat: kategori-værdierne
   * (familie/tal/farver/dyr/mad/krop/hjem/natur/hilsner) og register-
   * værdien vist i badges/rå data (word.category, word.register) er faste
   * DB-enum-nøgler, samme princip som verdenskortets regionnavne — kun
   * UI-chrome omkring dem oversættes.
   */
  vokabVaerksted: {
    tablistAriaLabel: "Værksted",
    tabList: "Ordliste",
    tabNew: "Nyt ord",
    aiSuggestions: "AI-forslag",
    loadingVocabulary: "Henter ordforrådet…",

    searchPlaceholder: "Søg (dansk eller arabisk)…",
    searchAriaLabel: "Søg i ordforråd",
    statusGroupAriaLabel: "Status",
    statusAll: "Alle",
    statusDraft: "Kladder",
    statusPublished: "Udgivet",
    categoryFilterAriaLabel: "Filtrér på kategori",
    allCategories: "Alle kategorier",
    emptyList: "Ingen ord matcher. Prøv et andet filter — eller tilføj et nyt ord ✨",

    levelAndRegister: (level: number, register: string) => `niveau ${level} · ${register}`,
    publishedBadge: "Udgivet",
    draftBadge: "Kladde",
    noAudioBadge: "Lyd mangler",
    unpublishButton: "Sluk lyset",
    publishButton: "Tænd lyset",

    arabicWordLabel: "Arabisk ord",
    arabicWordHint: "(med harakat)",
    letterHintPrefix: "Kobles automatisk til bogstavet ",
    danishMeaningLabel: "Dansk betydning",
    transliterationLabel: "Transskription",
    transliterationHint: "(barnevenlig)",
    categoryLabel: "Kategori",
    levelLabel: "Niveau",
    registerLabel: "Register",
    registerFusha: "Fusha",
    registerEveryday: "Hverdag",
    emojiLabel: "Emoji",
    emojiHint: "(3–6-skind)",
    saving: "Gemmer…",
    saveDraft: "Gem som kladde",
    newWordFooterNote:
      "Nye ord gemmes altid som kladde. Du tænder ordets lys fra ordlisten, når det er klar — lyd genereres automatisk bagefter.",

    validationArabicRequired: "Skriv det arabiske ord (med arabiske bogstaver).",
    validationDanishRequired: "Skriv den danske betydning.",
    validationTransliterationRequired: "Skriv en barnevenlig transskription.",
    validationDuplicate: "Ordet findes allerede i ordforrådet.",
    validationLetterNotDetected: "Kunne ikke genkende første bogstav — tjek stavningen.",

    aiWallNoteBold: "Muren gælder her:",
    aiWallNoteText: "AI'en foreslår kun. Hvert forslag gemmes af dig som kladde og bærer varigt mærket",
    aiWallNoteSuffix:
      ". Intet udgives uden din hånd på kontakten — og dubletter af eksisterende ord frasorteres automatisk.",
    suggestionCountLabel: "Antal forslag",
    aiThinking: "Claude tænker…",
    fetchSuggestions: "Hent forslag",
    suggestionsEmptyState: "Forslag vises her — alle fødes som kladder.",
    linkedToLetter: (name: string) => ` · kobles til ${name}`,
    draftBadgeToSave: "Gemmes som kladde",
    saveSuggestionButton: "Gem kladde",
    discardSuggestion: "Forkast",

    /** Fejlbeskeder fra engine.ts (parametriseret fra useVokabVaerksted.ts, ikke useT direkte i ikke-hook-funktioner). */
    fetchVocabularyError: "Ordforrådet kunne ikke hentes. Prøv igen.",
    fetchLettersError: "Bogstaverne kunne ikke hentes. Prøv igen.",
    wordAlreadyExists: "Ordet findes allerede i ordforrådet (word_ar er unik).",
    wordSaveFailed: "Ordet kunne ikke gemmes. Prøv igen.",
    publishChangeFailed: "Ændringen kunne ikke gemmes. Prøv igen.",
    aiSuggestionsFailed: "Forslag kunne ikke hentes. Tjek at du er logget ind som admin/editor.",
    aiUnexpectedResponse: "Uventet svar fra forslags-tjenesten. Prøv igen.",

    /** Notice-beskeder fra useVokabVaerksted.ts. */
    draftSavedNotice: (word: string) => `„${word}" er gemt som kladde`,
    publishedNotice: (word: string) => `„${word}" er udgivet 🏮`,
    publishedNoAudioNotice: (word: string) => `„${word}" er udgivet 🏮 — lyd genereres ved næste kørsel`,
    unpublishedNotice: (word: string) => `„${word}" er nu en kladde igen`,
    aiDraftSavedNotice: (word: string) => `„${word}" gemt som AI-kladde`,
  },
};

export type Dictionary = typeof da;
