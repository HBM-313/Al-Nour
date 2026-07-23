/**
 * ar.ts — arabisk UI-tekst (UDKAST, ikke ejer-godkendt endnu).
 *
 * Skrevet af Claude som forslag, samme arbejdsform som samtykketeksten
 * (plan-samtykke-flow.md): ejeren godkender ordlyden — og bør ideelt set
 * få en arabisktalende til at læse tonen igennem, da det er tekst der
 * møder familier direkte, selvom det ikke er aqidah og derfor ikke er
 * underlagt selve muren.
 *
 * `satisfies typeof da` (via Dictionary) betyder at TypeScript fejler
 * ved `tsc --noEmit`, hvis et navnerum eller en nøgle mangler her efter
 * en tilføjelse i da.ts — oversættelsen kan ikke komme bagud upåagtet.
 *
 * Sprogvalg: nutidig, neutral fusha (ikke dialekt) — samme register som
 * resten af platformens arabiske UI-tekst, og letforståeligt på tværs af
 * dansk-arabiske familier med forskellig dialektbaggrund (jf. SKILL.md
 * kerneviden 3's fusha/hverdagsarabisk-skel, som gælder læringsindhold —
 * denne UI-tekst er bevidst holdt i den mere formelle, dialektneutrale ende).
 */

import type { Dictionary } from "./da";

export const ar: Dictionary = {
  common: {
    back: "رجوع",
    somethingWrong: "حدث خطأ ما",
  },

  pinLogin: {
    whoAreYou: "من أنت؟",
    switchProfile: "→ تبديل الملف الشخصي",
    greeting: (name: string) => `مرحباً ${name}، أظهر رمزك`,
    yourCode: "رمزك",
    waitWithAdult: (seconds: number) => `انتظر قليلاً مع شخص كبير 🤝 (${seconds} ث)`,
    waitAlone: (seconds: number) => `انتظر قليلاً، وحاول مرة أخرى … (${seconds} ث)`,
    tryAgainWithAdult: "حاول مرة أخرى مع شخص كبير 🤝",
    wrongSoft: "حاول مرة أخرى! 🌙",
    wrongOther: "ليس تماماً — حاول مرة أخرى",
    notProvisioned:
      "هذا الملف الشخصي غير جاهز بعد. اطلب من شخص كبير تفعيل الوصول من بوابة الأهل.",
    networkError: "تعذّر التحقق من الرمز — حاول مرة أخرى بعد قليل",
    checking: "جارٍ التحقق …",
    welcome: (name: string) => `مرحباً بك يا ${name}! ✨`,
  },

  lessonPicker: {
    fetchError: (message: string) => `تعذّر جلب الدروس: ${message}`,
    loading: "جارٍ تحميل الدروس …",
    recommended: "موصى به",
  },

  tegnBogstavet: {
    lettersNotFound: "لم يتم العثور على حروف.",
    loadingLetters: "جارٍ تحميل الحروف …",
    roundDoneHeading: (skin) =>
      skin === "soft" ? "أضاءت كل الحروف!" : skin === "mid" ? "أحسنت الكتابة!" : "انتهت الجولة",
    cleanStrokes: (clean, total) => `${clean}/${total} خطوط نظيفة`,
    xpEarned: (xp) => `+${xp} نقطة`,
    savingProgress: "جارٍ حفظ التقدّم …",
    progressSaved: "تم حفظ التقدّم",
    progressQueued: "سيُحفظ نورك عندما تعود متصلاً بالإنترنت",
    progressError: "تعذّر الحفظ الآن — سنحاول مرة أخرى",
    traceAgain: "ارسم من جديد",
    traceLetter: (name) => `ارسم ${name}!`,
    hearAgain: "استمع إلى الحرف مرة أخرى",
    precision: (pct) => `الدقة: ${pct}٪`,
    stayInsideHint: "حاول أن تبقى داخل الحرف — سينمو النور أسرع ✨",
    stepDoneSoft: (name) => `${name} يضيء الآن! ⭐`,
    stepDoneClean: (name) => `خط نظيف — أحسنت يا ${name}!`,
    stepDoneDefault: (name) => `${name} أضاء!`,
    next: "التالي",
  },

  matchPar: {
    lightInValley: "النور في الوادي",
    loadingLanterns: "جارٍ إشعال الفوانيس …",
    tooFewWords: "عدد الكلمات في قاعدة البيانات غير كافٍ لتكوين الأزواج.",
    arabicCardLabel: "بطاقة عربية",
    danishCardLabel: (word) => `بطاقة دنماركية: ${word}`,
    registerFusha: "فصحى",
    registerEveryday: "عامية",
    valleyGlows: "الوادي يضيء! ✦",
    statsSoft: (totalPairs) => `أُضيئت كل الفوانيس الـ${totalPairs}`,
    statsMid: (totalPairs, xp, bestCombo) =>
      `${totalPairs} زوج · ${xp} نقطة · أفضل سلسلة ${bestCombo}`,
    statsTeen: (totalPairs, moves, precision, xp) =>
      `${totalPairs} زوج في ${moves} حركة · الدقة ${precision}٪ · ${xp} نقطة`,
    savingProgress: "جارٍ حفظ التقدّم …",
    progressSaved: "تم حفظ التقدّم ✓",
    progressQueued: "سيُحفظ نورك عندما تعود متصلاً بالإنترنت",
    progressError: "تعذّر الحفظ الآن — سنحاول مرة أخرى",
    newGame: "لعبة جديدة",
    playAgain: "العب مرة أخرى",
  },

  lytOgFind: {
    loadingLetters: "جارٍ تحميل الحروف …",
    noLettersFound: "لم يتم العثور على حروف في قاعدة البيانات.",
    questionOf: (current, total) => `السؤال ${current} من ${total}`,
    hearAgain: "استمع إلى الصوت مرة أخرى",
    syntheticVoiceNotice: "صوت اصطناعي — سيُستبدل بصوت حقيقي لاحقاً",
    audioNotRecorded: "لم يُسجَّل الصوت بعد",
    feedbackSoft: "أحسنت الإيجاد! ⭐",
    feedbackMid: (danish) => `كانت ${danish} — أحسنت!`,
    feedbackTeen: (danish) => `الإجابة الصحيحة: ${danish}`,
    next: "التالي",
    roundDoneHeading: (skin) =>
      skin === "soft" ? "أصبحت البلاد أكثر نوراً!" : skin === "mid" ? "أحسنت!" : "انتهت الجولة",
    correctFirstTry: (correct, total) => `${correct}/${total} إجابات صحيحة من المحاولة الأولى`,
    xpEarned: (xp) => `+${xp} نقطة`,
    savingProgress: "جارٍ حفظ التقدّم …",
    progressSaved: "تم حفظ التقدّم",
    progressQueued: "سيُحفظ نورك عندما تعود متصلاً بالإنترنت",
    progressError: "تعذّر الحفظ الآن — سنحاول مرة أخرى",
    playAgain: "العب مرة أخرى",
  },

  historierBjerge: {
    backToStories: "إلى القصص",
    backToMap: "العودة إلى الخريطة",
    loadingStories: "جارٍ تحميل القصص …",
    fetchError: "تعذّر جلب القصص الآن. حاول مرة أخرى.",
    emptyStateText:
      "جبال الحكايات لا تزال تنتظر أول قصة لها. عُد قريباً — النور في طريقه إلى الإضاءة.",
    sourceVerified: "مصدر موثّق",
    sourceLabel: (ref) => `المصدر: ${ref}`,
    quizHeading: "ماذا تتذكر؟",
    quizIntroSoft: "جرّب الضغط — لا توجد إجابة خاطئة هنا.",
    quizIntroOther: "اختر ما تتذكره من القصة.",
    quizFeedbackSoft: "تفكير جميل! ✨",
    quizFeedbackCorrect: "نعم، هكذا كان! 🌟",
    quizFeedbackWrong: "قريب جداً — الإجابة الصحيحة مُبرزة أعلاه.",
  },

  lektion: {
    fallbackTitle: "الدرس",
    backToMap: "إلى الخريطة",
    stepsLit: (lit, total) => `أُضيء ${lit} من ${total} خطوات`,
    loadingLanterns: "جارٍ إشعال الفوانيس …",
    lessonNotFound: "لم يتم العثور على الدرس.",
    lessonHasNoSteps: "لا توجد خطوات في هذا الدرس بعد.",
    stepOf: (current, total, title) => `الخطوة ${current} من ${total} · ${title}`,
    introStepsCount: (count) => `${count} خطوات · صعوبة متزايدة`,
    introStopAnytime: "يمكنك التوقف في أي وقت — كل شيء محفوظ",
    resumeAt: (step) => `تابع من حيث توقفت · الخطوة ${step} ✦`,
    startLesson: "ابدأ الدرس ✦",
    startOver: "ابدأ من جديد",
    softIntroHint: "خطوات قصيرة ولطيفة — بوتيرة الطفل",
    stepLitOf: (current, total) => `أُضيئت الخطوة ${current} من ${total} ✦`,
    xpThisSession: (xp) => `★ ${xp} نقطة في هذه الجلسة`,
    nextLabel: "التالي:",
    next: "التالي",
    stopHereSaved: "توقف هنا — كل شيء محفوظ",
    lessonGlows: "الدرس يضيء! ✦",
    allStepsDone: (total) => `اكتملت كل الخطوات الـ${total}`,
    xpSuffix: (xp) => ` · ★ ${xp} نقطة`,
    yoursNow: "أصبحت لك الآن — نال الوادي مزيداً من النور.",
    playAgain: "العب مرة أخرى",
    savingProgress: "جارٍ حفظ التقدّم …",
    progressSaved: "تم حفظ التقدّم ✓",
    progressQueued: "سيُحفظ نورك عندما تعود متصلاً بالإنترنت",
    progressError: "تعذّر الحفظ الآن — سنحاول مرة أخرى",
  },

  errorScreen: {
    copy: {
      soft: {
        title: "أوه! النور رمش قليلاً 🏮",
        body: "لم يكن خطأك. اضغط على النور الكبير لتحاول مرة أخرى.",
        cta: "حاول مرة أخرى ✨",
        exit: null,
      },
      mid: {
        title: "حدث خطأ للحظة",
        body: "ليس خطأك. تقدّمك محفوظ — حاول مرة أخرى.",
        cta: "حاول مرة أخرى",
        exit: "العودة إلى الخريطة",
      },
      teen: {
        title: "خطأ غير متوقع",
        body: "حدث خطأ تقني. يمكنك المحاولة مرة أخرى بثقة — تقدّمك محفوظ طوال الوقت.",
        cta: "حاول مرة أخرى",
        exit: "العودة إلى الخريطة",
      },
    },
  },

  consent: {
    heading: "الموافقة على نور",
    subheading: "قبل أن ننشئ أول ملف شخصي لطفلك، نحتاج إلى إذنك.",
    whatWeStoreHeading: "ما نحفظه عن طفلك",
    storeNickname: "الكنية (وليس الاسم الكامل)",
    storeBirthYear: "سنة الميلاد (فقط لتحديد المستوى المناسب)",
    storeAvatar: "الصورة الرمزية المختارة",
    storeProgress: "التقدّم في الدروس",
    neverAskText:
      "لا نطلب أبداً عنوان السكن أو رقم الهاتف أو الصور أو البريد الإلكتروني للطفل. لا ينشئ الطفل حساباً بنفسه أبداً.",
    legalBasisHeading: "الأساس القانوني",
    legalBasisText:
      "نعالج البيانات لأنك، كولي أمر، توافق على ذلك. يمكنك سحب موافقتك في أي وقت.",
    whereDataLivesHeading: "أين تُحفظ البيانات",
    whereDataLivesText: "لدى Supabase في الاتحاد الأوروبي (فرانكفورت). لا تغادر البيانات الاتحاد الأوروبي.",
    noAdsHeading: "لا إعلانات، لا تتبّع",
    noAdsText: "نور لا يعرض إعلانات أبداً ولا يتتبّع سلوك طفلك لأغراض تسويقية.",
    rightsHeading: "حقوقك",
    rightsText:
      "يمكنك دائماً عرض ملف طفلك أو تعديله أو حذفه. الحذف يزيل كل البيانات نهائياً بضغطة واحدة — لا يمكن التراجع عنه.",
    legalWarning:
      "⚠️ هذا مسودة أُعدّت وفق مبادئ المشروع — وليست استشارة قانونية. يجب مراجعتها قانونياً قبل الإطلاق العام.",
    versionLabel: (version) => `الإصدار: ${version}`,
    checkboxLabel: "أنا والد الطفل أو وليّ أمره، وأوافق كما هو موضح أعلاه.",
    registering: "جارٍ التسجيل …",
    submitButton: "أوافق وأتابع",
    submitError: "تعذّر تسجيل الموافقة. تحقّق من اتصالك وحاول مرة أخرى.",
  },

  opretProfil: {
    heading: "إنشاء ملف طفل",
    subtitleAbout: "أخبرنا قليلاً عن طفلك",
    subtitlePin: (name) => `رمز الحيوانات لـ${name} (اختياري)`,
    subtitleConfirm: "اختر نفس الحيوانات مرة أخرى",
    subtitleSummary: "تحقّق من أن كل شيء صحيح",
    nicknameLabel: "الكنية",
    nicknamePlaceholder: "مثلاً علي أو زينب",
    birthYearLabel: "سنة الميلاد",
    ageSuffix: (age) => `${age} سنة`,
    avatarLabel: "الصورة الرمزية",
    avatarNote: "· يمكن تغييرها لاحقاً",
    avatarAriaLabel: (n) => `صورة رمزية ${n}`,
    voiceLabel: "صوت الراوي",
    voiceFemale: "🎀 حبيبة",
    voiceFemaleSub: "صوت نسائي",
    voiceMale: "🎩 أحمد",
    voiceMaleSub: "صوت رجالي",
    privacyNote:
      "نحفظ فقط الكنية وسنة الميلاد والصورة الرمزية — لا أسماء كاملة أو عناوين أو بريد إلكتروني للأطفال أبداً.",
    next: "التالي",
    animalAriaLabel: (n) => `حيوان ${n}`,
    pinHint: (min, max, name) =>
      `اضغط على ${min}–${max} حيوانات بالترتيب الذي سيكون رمز ${name}.`,
    clear: "مسح",
    nextConfirmCode: "التالي — تأكيد الرمز",
    skipNoPin: "تخطّي — بدون رمز الآن",
    confirmMismatch: "للأسف، لم تكن نفس الحيوانات تماماً. حاول مرة أخرى 💛",
    confirmMatch: "ممتاز — الرمز مطابق! ✨",
    confirmHint: (length) => `أكّد الرمز بالضغط على نفس الـ${length} حيوانات بنفس الترتيب.`,
    tryAgain: "حاول مرة أخرى",
    backChooseNewCode: "رجوع — اختر رمزاً جديداً",
    sumNickname: "الكنية",
    sumBirthYear: "سنة الميلاد",
    sumAvatar: "الصورة الرمزية",
    sumVoice: "الصوت",
    sumPin: "رمز الحيوانات",
    sumBirthYearValue: (year, age) => `${year} · ${age} سنة`,
    sumPinNone: "لا يوجد (يمكن إضافته لاحقاً)",
    creating: "جارٍ الإنشاء…",
    createProfile: "إنشاء الملف",
    backAndEdit: "رجوع وتعديل",
    lanternLit: (name) => `فانوس ${name} أُضيء! 🏮`,
    profileCreatedSentence: (withPin) =>
      withPin ? "تم إنشاء الملف برمز الحيوانات." : "تم إنشاء الملف.",
    canLoginSentence: (name, withPin) =>
      withPin
        ? `يمكن لـ${name} الآن تسجيل الدخول من شاشة الأطفال برمزه.`
        : `يمكن لـ${name} الآن تسجيل الدخول من شاشة الأطفال.`,
    createAnother: "إنشاء ملف آخر",
    errorEmptyName: "اكتب كنية أولاً.",
    pinSaveFailed: "تم إنشاء الملف، لكن تعذّر حفظ رمز الحيوانات. حاول تعيينه مرة أخرى من صفحة الأهل.",
    errorGeneric: "حدث خطأ ما. تحقّق من اتصالك وحاول مرة أخرى.",
    errorRls: "ليس لديك صلاحية لإنشاء هذا الملف. سجّل الخروج ثم الدخول مرة أخرى وحاول.",
    errorBirthYear: "سنة الميلاد خارج النطاق المسموح.",
    errorNetwork: "لا يوجد اتصال. تحقّق من الإنترنت وحاول مرة أخرى.",
    errorFallback: "تعذّر إنشاء الملف. حاول مرة أخرى بعد قليل.",
  },

  appShell: {
    voiceLabelFemale: "🔊 حبيبة ♀",
    voiceLabelMale: "🔊 أحمد ♂",
    loadingLanterns: "جارٍ إشعال الفوانيس …",
    backToChildEntry: "‹ إلى مدخل الأطفال",
    loadingProfiles: "جارٍ تحميل الملفات …",
    noProfilesHeading: "لا توجد ملفات أطفال بعد",
    noProfilesText: "افتح منطقة الأهل لإنشاء أول ملف — عندها يُضاء فانوس طفلك الخاص.",
    parentLockButton: "🔒 الأهل",
    back: "‹ رجوع",
    adultsOnly: "للكبار فقط",
    parentLoginLabel: "تسجيل الدخول كوليّ أمر",
    parentGateIntro:
      "أدخل بريدك الإلكتروني وكلمة المرور لفتح منطقة الأهل. هنا يمكن إنشاء وحذف ملفات الأطفال.",
    emailPlaceholder: "البريد الإلكتروني",
    passwordPlaceholder: "كلمة المرور",
    wrongCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.",
    checking: "جارٍ التحقق …",
    openParentArea: "فتح منطقة الأهل",
    tagline: "تعلّم العربية — ودع النور ينمو",
    tryWithoutAccount: "جرّب بدون حساب",
    guestHint: "بدون حساب، يُحفظ التقدّم فقط على هذا الجهاز. حساب الأهل يحفظ نور طفلك بأمان.",
    switchUser: "تبديل المستخدم",
    guestBannerBold: "احفظ نورك.",
    guestBannerText:
      " هذا الجهاز فقط يتذكر تقدّمك الآن. اطلب من شخص كبير إنشاء حساب أهل مجاني — فيتبعك النور أينما ذهبت.",
    guestCreateCta: "إنشاء ←",
    ageGroupAriaLabel: "العمر",
    backToLanding: "‹ إلى الصفحة الرئيسية",
    migrationHeading: "🏮 يوجد نور محفوظ على هذا الجهاز",
    migrationIntro: "لعب أحدهم كضيف هنا وجمع نوراً في",
    migrationLessonPhrase: (count) => `${count} ${count === 1 ? "درس" : "دروس"}`,
    migrationQuestionLead: ". هل يريد",
    migrationQuestionTail: "أخذ ذلك إلى ملفه؟",
    migrationAccept: "نعم — خذ النور معي ✨",
    migrationDecline: "لا، لم يكن أنا",
    migrationHint: "إذا اخترت لا، يبقى نور الضيف على الجهاز ويمكن لملف آخر أخذه لاحقاً.",
  },
};
