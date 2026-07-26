/**
 * seed-vocab-images — engangs-seeder til I4-billedpiloten (plan-platformsmodning.md §3.1).
 *
 * Uploader de 11 håndbyggede "ren linje"-ikoner (dyr-pilot + de 2 niveau-1-huller)
 * til Storage-bucket 'images', opretter én media-række pr. billede, og kobler dem
 * på de 13 ordforråds-rækker via vocabulary.image_media_id.
 *
 * "Kat" har tre arabiske ord i databasen (hirra/qitt/bazzoon — dialektvarianter)
 * og genbruger bevidst ÉT billede/én media-række på tværs af alle tre
 * (medie-genbrug, jf. platformsplanens §9 medie-bibliotek-princip).
 *
 * Metode: billederne er IKKE AI-model-genereret i traditionel forstand — de er
 * håndkodet som SVG-vektorgrafik (fast palet + tyk kontur, "ren linje"-stilen fra
 * I1) og renderet til PNG. Markeres generated_by='ai' i media-tabellen for
 * ærlig bogføring (Claude er ophavet), reusable=true (kat-genbruget kræver det).
 * Rører aldrig aqidah — ordforråds-illustrationer er AI-tilladt indhold.
 *
 * Adgang: kræver Authorization: Bearer <SERVICE_ROLE_KEY> (samme mønster som
 * generate-audio) — ellers kunne enhver bruger skrive vilkårlige media-rækker.
 *
 * Kald: POST, ingen body nødvendig. Idempotent — et ord der allerede har
 * image_media_id springes over ved gentagne kald.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

// Kildebillederne hentes ved kørsel fra repoets 'main'-branch i stedet for at
// indlejre ~115 KB base64 i funktionens kildekode — mindre risiko for
// transskriptionsfejl i binærdata, og filerne kan ses/diffes normalt i repoet.
// Ligger i supabase/seed-assets/vocab-images/ — kan slettes når alle 13
// ordforråds-rækker har fået deres image_media_id (denne funktion er idempotent
// og reelt kun brugt til selve seedingen, ikke løbende drift).
const RAW_BASE = "https://raw.githubusercontent.com/HBM-313/Al-Nour/main/supabase/seed-assets/vocab-images";

interface WorkItem {
  key: string;
  vocabularyIds: string[];
  tags: string[];
}

// Verificeret mod live-DB i sessionen (vocabulary.id) — se handoff.md session 29.
const WORK_ITEMS: WorkItem[] = [
  { key: "kat", vocabularyIds: [
      "a5fe1505-89bf-4e9b-bae5-35a0d2e11338", // hirra
      "b6ec55bb-a4c9-465f-acbe-44376d3c3793", // qitt
      "5ee5b453-ba33-402e-ba8b-370b2c0dc32e", // bazzoon
    ], tags: ["illustration", "ren-linje", "dyr-pilot", "kat"] },
  { key: "elefant", vocabularyIds: ["41f2b2c1-2ce0-4c0b-be6f-9fef42da8de0"], tags: ["illustration", "ren-linje", "dyr-pilot", "elefant"] },
  { key: "faar", vocabularyIds: ["3e855d81-e3d4-45c2-a13a-bd06f9792a74"], tags: ["illustration", "ren-linje", "dyr-pilot", "faar"] },
  { key: "fisk", vocabularyIds: ["154223a3-53a1-47e3-ac98-b4ca05f47daf"], tags: ["illustration", "ren-linje", "dyr-pilot", "fisk"] },
  { key: "froe", vocabularyIds: ["b35a9f5d-2419-4453-ae8b-edc687a940d7"], tags: ["illustration", "ren-linje", "dyr-pilot", "froe"] },
  { key: "giraf", vocabularyIds: ["46c42f75-796f-448b-b19c-05d15e01d2c5"], tags: ["illustration", "ren-linje", "dyr-pilot", "giraf"] },
  { key: "hund", vocabularyIds: ["a731dce8-d014-41a2-b7d1-2abff9925ed4"], tags: ["illustration", "ren-linje", "dyr-pilot", "hund"] },
  { key: "kylling", vocabularyIds: ["bf5bfafb-c82b-46db-a2a9-551bde8a2f63"], tags: ["illustration", "ren-linje", "dyr-pilot", "kylling"] },
  { key: "ulv", vocabularyIds: ["17a5ac52-8163-41b7-bbe7-5394be259d8e"], tags: ["illustration", "ren-linje", "dyr-pilot", "ulv"] },
  { key: "bord", vocabularyIds: ["0f4a427c-e05e-4b7a-a610-6aec277e65a8"], tags: ["illustration", "ren-linje", "hul-ord", "bord"] },
  { key: "hage", vocabularyIds: ["5c9eae20-aaec-47bd-b510-9c20a7825e71"], tags: ["illustration", "ren-linje", "hul-ord", "hage"] },
];

/** Samme service-role-tjek som generate-audio (env-match, JWT-claim-fallback). */
function isServiceRoleToken(bearer: string, envServiceKey: string): boolean {
  if (envServiceKey && bearer === envServiceKey) return true;
  try {
    const payloadB64 = bearer.split(".")[1];
    if (!payloadB64) return false;
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    const claims = JSON.parse(json);
    return claims?.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Kun POST understøttes" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const envServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!isServiceRoleToken(bearer, envServiceKey)) {
    return json({ error: "Kræver service_role-nøgle" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const effectiveServiceKey = envServiceKey || bearer;
  const db = createClient(supabaseUrl, effectiveServiceKey);

  // Cache-busting: samme fælde som generate-audio — tidsstempel i filnavnet.
  const generationStamp = Date.now();

  const results: Array<{ key: string; ok: boolean; error?: string; skipped?: boolean; vocabularyIds?: string[] }> = [];

  for (const item of WORK_ITEMS) {
    try {
      // Idempotent: spring over hvis ALLE mål-ord allerede har et billede.
      const existing = await db
        .from("vocabulary")
        .select("id, image_media_id")
        .in("id", item.vocabularyIds);
      if (existing.error) {
        results.push({ key: item.key, ok: false, error: `select: ${existing.error.message}` });
        continue;
      }
      const allDone = (existing.data ?? []).every((r) => r.image_media_id !== null);
      if (allDone && existing.data && existing.data.length === item.vocabularyIds.length) {
        results.push({ key: item.key, ok: true, skipped: true });
        continue;
      }

      const srcUrl = `${RAW_BASE}/${item.key}.png`;
      const fetched = await fetch(srcUrl);
      if (!fetched.ok) {
        results.push({ key: item.key, ok: false, error: `fetch ${srcUrl}: ${fetched.status}` });
        continue;
      }
      const bytes = new Uint8Array(await fetched.arrayBuffer());
      const filename = `vocab/${item.key}-${generationStamp}.png`;

      const up = await db.storage.from("images").upload(filename, bytes, {
        contentType: "image/png",
        upsert: true,
      });
      if (up.error) {
        results.push({ key: item.key, ok: false, error: `upload: ${up.error.message}` });
        continue;
      }
      const publicUrl = db.storage.from("images").getPublicUrl(filename).data.publicUrl;

      const media = await db
        .from("media")
        .insert({
          type: "image",
          url: publicUrl,
          tags: item.tags,
          generated_by: "ai",
          is_recitation: false,
          reusable: true,
        })
        .select("id")
        .single();
      if (media.error) {
        results.push({ key: item.key, ok: false, error: `media: ${media.error.message}` });
        continue;
      }

      const upd = await db
        .from("vocabulary")
        .update({ image_media_id: media.data.id })
        .in("id", item.vocabularyIds);
      if (upd.error) {
        results.push({ key: item.key, ok: false, error: `vocabulary: ${upd.error.message}` });
        continue;
      }

      results.push({ key: item.key, ok: true, vocabularyIds: item.vocabularyIds });
    } catch (e) {
      results.push({ key: item.key, ok: false, error: e instanceof Error ? e.message : "ukendt fejl" });
    }
  }

  const done = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok);
  return json({
    uploaded: done,
    already_done: skipped,
    failed: failed.length,
    failures: failed,
    hint: failed.length > 0 ? "Kald funktionen igen — allerede uploadede springes over." : "Alle 13 ordforråds-rækker har nu billede ✓",
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
