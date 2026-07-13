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
  id: string;
  auth_user_id: string;
  email: string;
  role: AccountRole;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  owner_account_id: string;
  display_name: string; // first name / nickname only — data minimization
  avatar_character_id: string | null;
  birth_year: number;
  ui_language: "da" | "ar";
  transliteration_enabled: boolean;
  current_level: 1 | 2 | 3 | 4;
  created_at: string;
  updated_at: string;
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
  streak_count: number;
  last_completed_at: string | null;
  created_at: string;
  updated_at: string;
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
