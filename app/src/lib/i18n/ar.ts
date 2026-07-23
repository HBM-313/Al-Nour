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
};
