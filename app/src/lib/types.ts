/**
 * Domain types — mirrors supabase/migrations/0001_schema.sql exactly.
 *
 * THE SACRED BOUNDARY (den hellige grænse):
 * ContentType is the most important type in this codebase. 'aqidah' content
 * is NEVER AI-generated — it is human-provided from authorized sources and
 * approver-published only. Any code path that creates content via the
 * Claude API must hardcode content_type: 'ai_allowed'. See
 * src/lib/ai/ for the enforcement layer.
 */

export type AccountRole = "parent" | "teacher" | "admin" | "editor" | "approver";

export type ContentType = "aqidah" | "ai_allowed";

export type ContentWorld =
  | "bogstavernes_dal" // Sprog — AI-tilladt
  | "historiernes_bjerge" // Ahlulbayt/aqidah — kilde-verificeret
  | "hverdagshaven"; // Akhlaq — AI-tilladt

/**
 * The holy figures (the Prophet ﷺ and the 12 Imams) are only ever
 * represented as light. There is intentionally NO variant for depicting
 * them as a figure/face/body — making that state unrepresentable in the
 * type system, exactly as the DB enum does.
 */
export type SacredRepresentation = "light" | "none";

export type CharacterRole = "avatar_option" | "companion" | "region_friend";

export type ProgressStatus = "not_started" | "in_progress" | "completed";

/** Age skins: one world, three presentation layers. Changes HOW, never WHAT. */
export type AgeSkin = "soft" | "mid" | "teen";

export interface Account {
  /** ER auth.uid() — ingen separat auth_user_id-kolonne (dokumenteret afvigelse fra 0001, se supabase/migrations/README.md) */
  id: string;
  email: string;
  role: AccountRole;
  display_name: string | null;
  /** GDPR-retsgrundlag (fase1b_profiler_pin_samtykke) — sat ved samtykke-accept */
  consent_given_at: string | null;
  consent_version: string | null;
  created_at: string;
  updated_at: string;
}

export type VoicePref = "female" | "male";

export interface Profile {
  id: string;
  owner_account_id: string;
  display_name: string; // first name / nickname only — data minimization
  /**
   * Emoji/kort tekst-kode for barnets valgte figur (live-kolonne er `text`,
   * bevidst afvigelse fra 0001-designets avatar_character_id — se
   * supabase/migrations/README.md). IKKE "rettes".
   */
  avatar: string | null;
  birth_year: number;
  ui_language: "da" | "ar";
  transliteration_enabled: boolean;
  current_level: 1 | 2 | 3 | 4;
  /**
   * Bcrypt-hash af dyre-pin-sekvensen (pool-index, fx "0,1,2"). ALDRIG
   * klartekst. Null = intet pin sat — profilen er ulåst (forælderens valg).
   * Sættes/tjekkes udelukkende via RPC (set_child_pin/verify_child_pin);
   * hashen forlader aldrig databasen mod klienten.
   */
  pin_hash: string | null;
  /** Oplæser-stemme — afløser lib/voicePref.ts's localStorage når profil er logget ind */
  preferred_voice: VoicePref;
  /**
   * Global streak for barnet (Leverance 1.3) — sættes udelukkende af
   * record_progress()-RPC'en. Erstatter den tidligere pr.-lektion-streak
   * på Progress.streak_count (som er frosset, se supabase/migrations/README.md).
   */
  streak_count: number;
  /** Sidste dag barnet fuldførte noget (dato, ikke tidsstempel) — bruges kun af record_progress()'s streak-regel. */
  last_active_day: string | null;
  /**
   * Barnets EGEN auth.users-id (Leverance B1, plan-boernesession-og-dashboard.md).
   * NULL indtil profilen er aktiveret via Edge Function provision-child-auth.
   * Sættes UDELUKKENDE af service-rollen — aldrig skrivbart fra klienten
   * (RLS: profiles_owner_all har ingen with_check der tillader det, og
   * custom_access_token_hook er den eneste kilde til user_role='child').
   * Selve pin-login der bruger dette til at udstede en session er B2.
   */
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizOption {
  text_da: string;
  correct: boolean;
}

/** "Hvad husker du?"-quiz efter en aqidah-fortælling. Lever på samme
 * content-række som body_da og er derfor underlagt samme mur (RLS +
 * enforce_aqidah_wall): ai_service kan aldrig skrive det, kun
 * redaktør/godkender via historie-værkstedet. Se migration
 * 20260721_historier_quiz_da og content_quiz_da_is_array-constrainten. */
export interface QuizQuestion {
  question_da: string;
  options: QuizOption[];
}

export interface Content {
  id: string;
  world: ContentWorld;
  content_type: ContentType;
  is_source_verified: boolean;
  source_reference: string | null;
  is_locked_from_ai: boolean;
  title_da: string;
  title_ar: string | null;
  body_da: string;
  body_ar: string | null;
  transliteration: string | null;
  audio_url: string | null;
  sacred_representation: SacredRepresentation;
  min_age: number;
  max_age: number;
  body_da_simple: string | null;
  body_da_medium: string | null;
  body_da_deep: string | null;
  quiz_da: QuizQuestion[] | null;
  /** Alders-varianter af quizzen — samme fallback-mønster som body_da_simple/medium/deep.
   * Tom/null variant betyder gruppen falder tilbage på den fælles quiz_da. Se quizForSkin(). */
  quiz_da_simple: QuizQuestion[] | null;
  quiz_da_medium: QuizQuestion[] | null;
  quiz_da_deep: QuizQuestion[] | null;
  level: 1 | 2 | 3 | 4 | null;
  is_published: boolean;
  published_by: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  name: string;
  name_arabic: string | null;
  gender: "boy" | "girl" | null;
  role: CharacterRole;
  region: ContentWorld | null;
  name_meaning_da: string | null;
  name_meaning_ar: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Lesson {
  id: string;
  world: ContentWorld;
  order_index: number;
  title_da: string;
  title_ar: string | null;
  content_ids: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Progress {
  id: string;
  profile_id: string;
  lesson_id: string;
  status: ProgressStatus;
  xp: number;
  /**
   * FROSSET siden Leverance 1.3 — record_progress() sætter/opdaterer ikke
   * længere denne kolonne (streak er global, se Profile.streak_count).
   * Bevaret som historisk/audit-felt. Læs IKKE dette for streak-visning.
   */
  streak_count: number;
  /** Næste trin (0-baseret index i lektionens lesson_steps) — "fortsæt hvor du slap" */
  current_step: number;
  last_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Lektions-struktur: 7 lektioner à 4 bogstaver (hija'i), trin-sekvens pr.
// lektion med stigende sværhedsgrad. Kortets lanterner er lektioner —
// spillene er mekanikker, ikke destinationer.
// ----------------------------------------------------------------------------

export type StepGameType = "lyt_og_find" | "tegn_bogstavet" | "match_par";

export type StepDifficulty = "easy" | "mixed" | "hard";

export interface LessonStep {
  id: string;
  lesson_id: string;
  order_index: number;
  game_type: StepGameType;
  /** Vises i pusterummet mellem trin ("Mød de nye bogstaver") */
  title_da: string;
  /** Lektionens NYE bogstaver (letters.position, 1-28) */
  letter_positions: number[];
  /** true = medtag også bogstaver/ord fra tidligere lektioner (repetition) */
  include_review: boolean;
  difficulty: StepDifficulty;
  /** Antal spørgsmål/bogstaver/par — fortolkes af spiltypen */
  question_count: number;
  /** Hvilke aldersskind trinnet gælder for */
  skins: AgeSkin[];
  created_at: string;
  updated_at: string;
}

/** Trinene et givet aldersskind faktisk skal spille, i rækkefølge. */
export function stepsForSkin(
  steps: readonly LessonStep[],
  skin: AgeSkin,
): LessonStep[] {
  return steps
    .filter((s) => s.skins.includes(skin))
    .sort((a, b) => a.order_index - b.order_index);
}

/**
 * Trin-parametre som spillene modtager når de kører INDE i en lektion.
 * Spillene beholder deres frit-spil-tilstand når `step` ikke gives —
 * lektions-rammen ejer progress-gem, så spillets eget gem slås fra.
 */
export interface LessonStepParams {
  /** Lektionens NYE bogstaver (letters.position, 1-28) */
  letterPositions: number[];
  /** true = medtag også alt lært før denne lektion (repetition) */
  includeReview: boolean;
  difficulty: StepDifficulty;
  questionCount: number;
  /** Bogstav-former som fokus (trin 5/6) */
  formsMode: boolean;
}

export function stepParamsFrom(step: LessonStep): LessonStepParams {
  return {
    letterPositions: step.letter_positions,
    includeReview: step.include_review,
    difficulty: step.difficulty,
    questionCount: step.question_count,
    // De 'hard'-markerede trin i pensum er netop form-trinnene (5 & 6)
    formsMode: step.difficulty === "hard",
  };
}

/** Derive the age skin from a birth year. One world, three skins. */
export function ageSkinForBirthYear(birthYear: number, now = new Date()): AgeSkin {
  const age = now.getFullYear() - birthYear;
  if (age <= 6) return "soft";
  if (age <= 10) return "mid";
  return "teen";
}

/** Pick the right Danish body variant for the age skin, falling back to body_da. */
export function bodyForSkin(content: Content, skin: AgeSkin): string {
  switch (skin) {
    case "soft":
      return content.body_da_simple ?? content.body_da;
    case "mid":
      return content.body_da_medium ?? content.body_da;
    case "teen":
      return content.body_da_deep ?? content.body_da;
  }
}

/** Pick the right quiz variant for the age skin, falling back to quiz_da (the shared quiz).
 * Same fallback pattern as bodyForSkin: an empty/null variant means that age group sees the
 * shared quiz instead. Returns null if there is no quiz at all for this story. */
export function quizForSkin(content: Content, skin: AgeSkin): QuizQuestion[] | null {
  const variant =
    skin === "soft" ? content.quiz_da_simple : skin === "mid" ? content.quiz_da_medium : content.quiz_da_deep;
  if (variant && variant.length > 0) return variant;
  return content.quiz_da;
}

// ----------------------------------------------------------------------------
// Fase 1: Bogstavernes Dal — letters & vocabulary (matches live schema)
// ----------------------------------------------------------------------------

export type LetterForm = "isolated" | "initial" | "medial" | "final";

export interface Letter {
  id: string;
  position: number; // 1-28, hija'i order
  letter: string; // base character (isolated form)
  name_ar: string; // e.g. ألف
  name_da: string; // e.g. Alif
  sound_hint_da: string;
  is_connector: boolean;
  form_isolated: string;
  form_initial: string;
  form_medial: string;
  form_final: string;
  /** Kvindestemme (standard/fallback). Lyd-reglen: TTS/AI tilladt, aldrig recitation (DB-enforced). */
  audio_media_id: string | null;
  /** Mandsstemme — valgt når barnets stemmepræference er 'male' */
  audio_media_id_male: string | null;
  level: number;
  created_at: string;
}

export type VocabularyRegister = "fusha" | "everyday";

export type VocabularyCategory =
  | "familie"
  | "tal"
  | "farver"
  | "dyr"
  | "mad"
  | "krop"
  | "hjem"
  | "natur"
  | "hilsner";

export interface VocabularyWord {
  id: string;
  word_ar: string; // vocalized (with harakat)
  transliteration: string;
  word_da: string;
  category: VocabularyCategory;
  register: VocabularyRegister;
  first_letter_id: string | null;
  level: number;
  /**
   * Emoji der bærer ordets betydning for 3–6-skindet (ingen læsekrav).
   * Bruges som visuel fallback indtil et rigtigt billede (image_media_id)
   * kobles på — billedet vinder altid over emojien.
   */
  emoji: string | null;
  image_media_id: string | null;
  /** Kvindestemme (standard/fallback) — AI-lyd tilladt */
  audio_media_id: string | null;
  /** Mandsstemme — valgt når barnets stemmepræference er 'male' */
  audio_media_id_male: string | null;
  is_published: boolean;
  /**
   * Proveniens (migration 20260719): 'human' eller 'ai'. AI-foreslåede ord
   * kan aldrig fødes udgivne — håndhævet i DB af trg_vocab_ai_draft_only.
   */
  suggested_by: "human" | "ai";
  created_at: string;
  updated_at: string;
}
