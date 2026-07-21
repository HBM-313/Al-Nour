/**
 * Historiernes Bjerge — barnets side (Fase 2, milepæl 2026-07-21).
 *
 * MUREN her: denne fil læser UDELUKKENDE udgivne, kilde-verificerede
 * aqidah-fortællinger (`is_published=true`, `is_source_verified=true`).
 * Den skriver ALDRIG til content — det sker kun i historie-værkstedet.
 * Selv hvis koden her fejlede og glemte filtrene, ville RLS-politikken
 * `content_public_read_published` stadig forhindre en kladde i at blive
 * synlig — dette er blot et ekstra, eksplicit lag oven på databasens.
 */

import { supabase } from "@/lib/supabase";
import type { AgeSkin, Content } from "@/lib/types";

/** Guest-tilstand har intet birth_year — brug en repræsentativ alder pr. skind. */
const APPROX_AGE_FOR_SKIN: Record<AgeSkin, number> = {
  soft: 5,
  mid: 8,
  teen: 12,
};

export function ageForFetch(skin: AgeSkin, birthYear?: number): number {
  if (birthYear) return new Date().getFullYear() - birthYear;
  return APPROX_AGE_FOR_SKIN[skin];
}

export async function fetchStoriesForAge(
  age: number,
): Promise<{ ok: true; stories: Content[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("content")
    .select("*")
    .eq("world", "historiernes_bjerge")
    .eq("content_type", "aqidah")
    .eq("is_published", true)
    .eq("is_source_verified", true)
    .lte("min_age", age)
    .gte("max_age", age)
    .order("created_at", { ascending: true });
  if (error) {
    return { ok: false, error: "Fortællingerne kunne ikke hentes lige nu. Prøv igen." };
  }
  return { ok: true, stories: (data ?? []) as Content[] };
}
