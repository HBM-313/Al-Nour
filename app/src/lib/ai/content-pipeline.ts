/**
 * AI content pipeline — LAYER 2 OF THE AQIDAH WALL.
 *
 * The three layers (all must always hold):
 *   1. Database:  RLS + trigger reject aqidah writes from non-approver roles;
 *                 the ai_service Postgres role has no aqidah write path at all.
 *   2. Pipeline:  THIS FILE. The AI generation code path can only ever
 *                 produce content_type='ai_allowed'. It is hardcoded — there
 *                 is no parameter to change it.
 *   3. UI:        aqidah content renders a visible source-verified badge.
 *
 * DO NOT refactor this to accept content_type as a parameter. If you are
 * reading this because a task seems to require AI-written aqidah: stop.
 * Aqidah is human-provided from authorized sources only. The AI may at most
 * simplify the Danish wording of ALREADY APPROVED source text — and that
 * flow lives in the admin CMS with approver sign-off, not here.
 */

import type { Content, ContentWorld } from "@/lib/types";

/** The only worlds AI content may be created in. Historiernes Bjerge
 * (the aqidah world) is intentionally not assignable here. */
export type AiAllowedWorld = Exclude<ContentWorld, "historiernes_bjerge">;

export interface AiContentDraft {
  world: AiAllowedWorld;
  title_da: string;
  title_ar?: string;
  body_da: string;
  body_ar?: string;
  transliteration?: string;
  min_age: number;
  max_age: number;
  level?: 1 | 2 | 3 | 4;
}

/**
 * Builds the insert payload for AI-generated content.
 * content_type, is_source_verified, is_locked_from_ai and
 * sacred_representation are HARDCODED — no caller can override them.
 */
export function buildAiContentInsert(
  draft: AiContentDraft
): Omit<
  Content,
  "id" | "created_at" | "updated_at" | "published_by" | "published_at" | "created_by"
> {
  return {
    ...draft,
    title_ar: draft.title_ar ?? null,
    body_ar: draft.body_ar ?? null,
    transliteration: draft.transliteration ?? null,
    level: draft.level ?? null,

    // === The wall. Never parameterize these. ===
    content_type: "ai_allowed",
    is_source_verified: false,
    source_reference: null, // AI content never carries a source claim
    is_locked_from_ai: false,
    sacred_representation: "none",
    // ============================================

    audio_url: null,
    body_da_simple: null,
    body_da_medium: null,
    body_da_deep: null,
    quiz_da: null, // AI-tilladt indhold har ingen quiz herfra — quiz_da lever kun på aqidah-fortællinger, indtastet af redaktør/godkender
    quiz_da_simple: null,
    quiz_da_medium: null,
    quiz_da_deep: null,
    is_published: false, // AI output is always a draft; a human publishes.
  };
}
