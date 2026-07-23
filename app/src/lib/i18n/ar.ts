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
};
