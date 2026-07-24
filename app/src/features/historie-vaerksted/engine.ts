/**
 * Historie-værkstedet — engine (Fase 2-forberedelse, aqidah-workflow i praksis).
 *
 * MUREN i denne feature (strengere end Ordforråds-værkstedet):
 *  - `insertDraft` fødes ALTID som kladde: is_published:false,
 *    is_source_verified:false — for BÅDE redaktør og godkender. Der findes
 *    ingen genvej til at oprette en allerede-verificeret/udgivet række.
 *  - Redaktør KAN oprette og redigere kladder (migration
 *    `20260720_historier_redaktoer_aqidah_kladde`), men kan ALDRIG selv
 *    kilde-verificere eller udgive — spærret i to uafhængige DB-lag (RLS +
 *    triggerens Lag D), ikke kun i denne klientkode.
 *  - `verifySource` og `setPublished` er reserveret godkender/admin af RLS
 *    (`content_approver_update_aqidah`) — UI'et skjuler blot knapperne for
 *    redaktør, men det er databasen der håndhæver det, aldrig klienten.
 *  - Claude/AI skriver ALDRIG selv indholdet af `body_da` — dette felt er
 *    altid en ejer-leveret, allerede godkendt kildetekst indtastet af et
 *    menneske. Denne fil har ingen AI-forslagsfunktion, i modsætning til
 *    vokab-vaerksted/engine.ts.
 */

import { supabase } from "@/lib/supabase";
import type { Content, QuizQuestion } from "@/lib/types";
import type { Dictionary } from "@/lib/i18n";

/**
 * Oversatte beskeder til denne fil — kaldestedet (useHistorieVaerksted.ts,
 * som har `t = useT("da")`) leverer dem. Samme mønster som
 * OpretProfilMessages i features/opret-profil/engine.ts: en almindelig
 * (ikke-hook) funktion må aldrig selv kalde useT.
 */
export type HistorieVaerkstedMessages = Dictionary["historieVaerksted"];

export const ALDERSSPAEND = [
  { value: "3-14", label: "3–14 (alle)", min_age: 3, max_age: 14 },
  { value: "3-6", label: "3–6", min_age: 3, max_age: 6 },
  { value: "7-10", label: "7–10", min_age: 7, max_age: 10 },
  { value: "11-14", label: "11–14", min_age: 11, max_age: 14 },
] as const;
export type AlderKey = (typeof ALDERSSPAEND)[number]["value"];

/** Hent alle fortællinger i Historiernes Bjerge (staff ser også kladder, jf. content_staff_read_all). */
export async function fetchStories(
  messages: HistorieVaerkstedMessages,
): Promise<{ ok: true; stories: Content[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("world", "historiernes_bjerge")
    .eq("content_type", "aqidah")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: messages.fetchError };
  return { ok: true, stories: (data ?? []) as Content[] };
}

export interface AqidahDraftInput {
  title_da: string;
  title_ar: string | null;
  source_reference: string;
  body_da: string;
  body_da_simple: string | null;
  body_da_medium: string | null;
  body_da_deep: string | null;
  alder: AlderKey;
  level: 1 | 2 | 3 | 4;
  /** "Hvad husker du?"-quiz, fælles + tre alders-varianter. Tom/null variant
   * betyder den aldersgruppe falder tilbage på quiz_da (se lib/types quizForSkin). */
  quiz_da: QuizQuestion[] | null;
  quiz_da_simple: QuizQuestion[] | null;
  quiz_da_medium: QuizQuestion[] | null;
  quiz_da_deep: QuizQuestion[] | null;
}

/**
 * Validér én quiz-variant (fælles eller en aldersvariant) før gem.
 * Returnerer en fejlbesked eller null hvis alt er gyldigt. DB-constrainten
 * (`content_quiz_da*_is_array`) tjekker kun at feltet er et array eller null —
 * denne validering sikrer den faktiske brugbarhed (ingen tomme felter, præcis
 * ét rigtigt svar pr. spørgsmål), som databasen bevidst ikke håndhæver.
 */
export function validateQuizVariant(
  quiz: QuizQuestion[],
  variantLabel: string,
  messages: HistorieVaerkstedMessages,
): string | null {
  for (let qi = 0; qi < quiz.length; qi++) {
    const q = quiz[qi];
    if (!q.question_da.trim()) return messages.quizQuestionMissingText(variantLabel, qi + 1);
    if (q.options.length < 2) return messages.quizQuestionNeedsTwoOptions(variantLabel, qi + 1);
    if (q.options.some((o) => !o.text_da.trim()))
      return messages.quizQuestionEmptyOption(variantLabel, qi + 1);
    if (q.options.filter((o) => o.correct).length !== 1) {
      return messages.quizQuestionNeedsOneCorrect(variantLabel, qi + 1);
    }
  }
  return null;
}

function alderTilAldre(alder: AlderKey): { min_age: number; max_age: number } {
  const found = ALDERSSPAEND.find((a) => a.value === alder) ?? ALDERSSPAEND[0];
  return { min_age: found.min_age, max_age: found.max_age };
}

/**
 * Indsæt en ny fortælling som KLADDE — for både redaktør og godkender.
 * `is_published`/`is_source_verified` er hardcodet false; `sacred_representation`
 * er hardcodet 'light' (lys-reglen) og `is_locked_from_ai`/`source_reference`
 * håndhæves også af DB-constrainten `aqidah_requires_source` uafhængigt af dette.
 */
export async function insertDraft(
  input: AqidahDraftInput,
  messages: HistorieVaerkstedMessages,
): Promise<{ ok: true; story: Content } | { ok: false; error: string }> {
  const { min_age, max_age } = alderTilAldre(input.alder);
  const { data, error } = await supabase
    .from("content")
    .insert({
      world: "historiernes_bjerge",
      content_type: "aqidah",
      sacred_representation: "light",
      is_locked_from_ai: true,
      title_da: input.title_da,
      title_ar: input.title_ar || null,
      source_reference: input.source_reference,
      body_da: input.body_da,
      body_da_simple: input.body_da_simple || null,
      body_da_medium: input.body_da_medium || null,
      body_da_deep: input.body_da_deep || null,
      quiz_da: input.quiz_da,
      quiz_da_simple: input.quiz_da_simple,
      quiz_da_medium: input.quiz_da_medium,
      quiz_da_deep: input.quiz_da_deep,
      min_age,
      max_age,
      level: input.level,
      // === Muren: altid kladde ved fødsel, uanset hvem der opretter ===
      is_published: false,
      is_source_verified: false,
    })
    .select("*")
    .single();
  if (error) {
    return { ok: false, error: messages.insertWallRejected(error.message) };
  }
  return { ok: true, story: data as Content };
}

/**
 * Redigér en eksisterende fortælling. Redaktør kan kun dette mens rækken er
 * uverificeret+uudgivet (RLS `content_editor_update_aqidah_draft`); godkender
 * kan altid. UI'et gætter ikke på tilladelser — fejlen fra RLS er sandheden.
 */
export async function updateDraft(
  id: string,
  input: AqidahDraftInput,
  messages: HistorieVaerkstedMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { min_age, max_age } = alderTilAldre(input.alder);
  const { data, error } = await supabase
    .from("content")
    .update({
      title_da: input.title_da,
      title_ar: input.title_ar || null,
      source_reference: input.source_reference,
      body_da: input.body_da,
      body_da_simple: input.body_da_simple || null,
      body_da_medium: input.body_da_medium || null,
      body_da_deep: input.body_da_deep || null,
      quiz_da: input.quiz_da,
      quiz_da_simple: input.quiz_da_simple,
      quiz_da_medium: input.quiz_da_medium,
      quiz_da_deep: input.quiz_da_deep,
      min_age,
      max_age,
      level: input.level,
    })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: messages.updateFailed(error.message) };
  if (!data || data.length === 0) {
    return { ok: false, error: messages.updateWallRejected };
  }
  return { ok: true };
}

/** Markér kilden verificeret — kun godkender/admin (RLS + trigger Lag D). */
export async function verifySource(
  id: string,
  messages: HistorieVaerkstedMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("content").update({ is_source_verified: true }).eq("id", id);
  if (error) return { ok: false, error: messages.verifyWallRejected(error.message) };
  return { ok: true };
}

/** Fjern kilde-verifikationen igen (fortryd) — kun godkender/admin. */
export async function unverifySource(
  id: string,
  messages: HistorieVaerkstedMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("content").update({ is_source_verified: false }).eq("id", id);
  if (error) return { ok: false, error: messages.unverifyFailed(error.message) };
  return { ok: true };
}

/** Tænd/sluk lyset — udgivelse kræver is_source_verified=true (aqidah_publish_requires_verification). */
export async function setPublished(
  id: string,
  published: boolean,
  messages: HistorieVaerkstedMessages,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("content")
    .update({ is_published: published, published_at: published ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: messages.publishWallRejected(error.message) };
  return { ok: true };
}
