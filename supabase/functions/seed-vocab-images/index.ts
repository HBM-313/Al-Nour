/**
 * seed-vocab-images — engangs-seeder til I4-billedproduktionen (plan-platformsmodning.md §3.1).
 *
 * Uploader håndbyggede "ren linje"-ikoner til Storage-bucket 'images', opretter
 * én media-række pr. billede, og kobler dem på ordforråds-rækkerne via
 * vocabulary.image_media_id. Batch 1 (session 29): dyr-pilot + 2 huller (13
 * rækker). Batch 2 (session 30): familie, hjem, krop, mad, natur, hilsner,
 * tal, farver (54 rækker) — dermed hele niveau 1 dækket.
 *
 * Flere ord med samme danske oversættelse (dialektvarianter, fx "far" =
 * أَب/بَابَا, "kat" = tre ord) genbruger bevidst ÉT billede/én media-række
 * (medie-genbrug, jf. platformsplanens §9).
 *
 * Metode: billederne er IKKE AI-model-genereret i traditionel forstand — de er
 * håndkodet som SVG-vektorgrafik (fast palet + tyk kontur, "ren linje"-stilen fra
 * I1) og renderet til PNG. Markeres generated_by='ai' i media-tabellen for
 * ærlig bogføring (Claude er ophavet), reusable=true (dialekt-genbrug kræver det).
 * Rører aldrig aqidah — ordforråds-illustrationer er AI-tilladt indhold.
 * Undtagelse fra den varme palet: `farver`-kategorien (blå/grøn/gul/rød) viser
 * bevidst den RIGTIGE farve — det er selve pointen med de fire ord.
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

  // --- Batch 2 (session 30): familie, hjem, krop, mad, natur, hilsner, tal, farver ---
  { key: "bedstefar", vocabularyIds: ["32e68895-ef64-41b3-97f0-2e48aa6944d2"], tags: ["illustration", "ren-linje", "familie"] },
  { key: "bedstemor", vocabularyIds: ["2a80947b-e16a-4f86-84c1-d66345f994ef"], tags: ["illustration", "ren-linje", "familie"] },
  { key: "bror", vocabularyIds: ["f00366cd-28b9-41a9-84bd-c2fde7d9efbb"], tags: ["illustration", "ren-linje", "familie"] },
  { key: "far", vocabularyIds: [
      "5d4c45b4-6eea-4458-8906-548494c08fae", // baaba
      "d95cc1ec-cf0f-4c70-94f6-0238bad6df9f", // ab
    ], tags: ["illustration", "ren-linje", "familie", "far"] },
  { key: "mor", vocabularyIds: [
      "0a6ff2bc-8251-4e05-b665-5f3132493604", // umm
      "ebe7f356-ffce-459c-9a1a-321abcbdb93c", // maama
    ], tags: ["illustration", "ren-linje", "familie", "mor"] },
  { key: "soen", vocabularyIds: ["b3cbb36e-d74d-49f7-864c-be29c7d2856a"], tags: ["illustration", "ren-linje", "familie"] },
  { key: "soester", vocabularyIds: ["31e8c7a2-ec4e-49b1-8cc7-eccf787b8fbb"], tags: ["illustration", "ren-linje", "familie"] },

  { key: "hej", vocabularyIds: ["8ca815c7-ae25-46aa-80f4-f71ad1cd31db"], tags: ["illustration", "ren-linje", "hilsner"] },
  { key: "ja", vocabularyIds: ["7f5fb427-0fe3-42e4-8545-def44f43891e"], tags: ["illustration", "ren-linje", "hilsner"] },
  { key: "nej", vocabularyIds: ["1b455c39-7423-4e95-8734-c4ce3b843b8f"], tags: ["illustration", "ren-linje", "hilsner"] },
  { key: "tak", vocabularyIds: ["414f6642-da3e-41ea-931f-b85a621c1f59"], tags: ["illustration", "ren-linje", "hilsner"] },

  { key: "bog", vocabularyIds: ["1b5bf432-0c0e-4364-984f-09ce012cddc4"], tags: ["illustration", "ren-linje", "hjem"] },
  { key: "dor", vocabularyIds: ["91c376c9-df15-47e8-908e-486a59609b1f"], tags: ["illustration", "ren-linje", "hjem"] },
  { key: "hus", vocabularyIds: [
      "58a21ae8-40a1-49f4-9817-8f154c9c601b", // bayt
      "ff260442-63ac-4014-a852-3908e3022070", // daar
    ], tags: ["illustration", "ren-linje", "hjem", "hus"] },
  { key: "seng", vocabularyIds: ["01452f60-94ab-4793-9074-7f70e232caff"], tags: ["illustration", "ren-linje", "hjem"] },
  { key: "stol", vocabularyIds: ["a2a53d7e-28a2-4f6c-bb9c-2a9730d31cbc"], tags: ["illustration", "ren-linje", "hjem"] },
  { key: "vaerelse", vocabularyIds: ["f22adcfa-25f1-46ca-898c-53ccee6b3337"], tags: ["illustration", "ren-linje", "hjem"] },

  { key: "haand", vocabularyIds: [
      "73b1cd63-cd76-4a31-af5e-03afffcb2428", // iid
      "a2f65036-29f5-4fa8-a781-d32969dccd9a", // yad
    ], tags: ["illustration", "ren-linje", "krop", "haand"] },
  { key: "hoved", vocabularyIds: [
      "143ca298-1113-471f-8e4a-6b6dd63610e2", // ra's
      "fbcada09-589d-44cf-be17-8c7427651f2f", // raas
    ], tags: ["illustration", "ren-linje", "krop", "hoved"] },
  { key: "mund", vocabularyIds: ["dded1a7a-6891-4a3c-b588-fde78337f1b6"], tags: ["illustration", "ren-linje", "krop"] },
  { key: "negl", vocabularyIds: ["1ce8defe-e4cc-4568-93bf-6456c7a252ae"], tags: ["illustration", "ren-linje", "krop"] },
  { key: "oje", vocabularyIds: ["aefede3a-9eaa-49cd-bccf-85674d3a7bc0"], tags: ["illustration", "ren-linje", "krop"] },
  { key: "ore", vocabularyIds: ["3413c513-c227-4659-b989-10c23743237d"], tags: ["illustration", "ren-linje", "krop"] },

  { key: "aeble", vocabularyIds: ["e745cd28-73bf-47ab-a554-2c9410e70cbb"], tags: ["illustration", "ren-linje", "mad"] },
  { key: "aeg", vocabularyIds: ["21b90012-0e81-4c6e-aa75-06b6be9fec92"], tags: ["illustration", "ren-linje", "mad"] },
  { key: "broed", vocabularyIds: ["4b5415f7-ca8f-4a9c-898a-c444d7879001"], tags: ["illustration", "ren-linje", "mad"] },
  { key: "maelk", vocabularyIds: ["63fe1ab5-cc58-4a83-a368-2b9be2bd8fa7"], tags: ["illustration", "ren-linje", "mad"] },
  { key: "ris", vocabularyIds: ["9e3839a9-c1e6-4b7b-ac22-72cc7656324f"], tags: ["illustration", "ren-linje", "mad"] },
  { key: "vand", vocabularyIds: [
      "d09ab565-698f-4f24-b7ac-f7036fafa46c", // muwayya
      "5f67856a-4c40-4956-92bc-316eac1efb07", // maa'
    ], tags: ["illustration", "ren-linje", "mad", "vand"] },

  { key: "blomst", vocabularyIds: ["376ef877-03d1-4212-b002-69f31ac36dc2"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "halvmaane", vocabularyIds: ["7308ec37-0774-4e32-bb36-edc321c9b3ee"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "ler", vocabularyIds: ["8cc67706-3ff4-4a7a-a878-6c0b2ff516be"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "lys", vocabularyIds: [
      "dc8f95c2-bfee-4fb7-b14f-6987f5815124", // daw'
      "691fefab-104b-4f66-8ea3-9923e5edf5b0", // nuur
    ], tags: ["illustration", "ren-linje", "natur", "lys"] },
  { key: "maane", vocabularyIds: ["88d225df-25d0-410e-adf3-979eba827a04"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "skyer", vocabularyIds: ["8efad504-c146-4c64-a026-421ff8a57259"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "skygge", vocabularyIds: ["34cdfc0a-21a2-475f-b783-9304b6506c8e"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "sol", vocabularyIds: ["56401874-d53e-4029-b28d-9d0e018bd32a"], tags: ["illustration", "ren-linje", "natur"] },
  { key: "stjerne", vocabularyIds: ["ef5b9626-f92f-4c75-a92a-8f801a626312"], tags: ["illustration", "ren-linje", "natur"] },

  { key: "en", vocabularyIds: ["b4640cf3-f557-4308-a1ba-896ee525dbfe"], tags: ["illustration", "ren-linje", "tal"] },
  { key: "to", vocabularyIds: ["2a3ecbe2-1090-4380-8179-dfda5d9cfbc5"], tags: ["illustration", "ren-linje", "tal"] },
  { key: "tre", vocabularyIds: ["0479ec9c-cae2-4325-ba12-725ff9f93378"], tags: ["illustration", "ren-linje", "tal"] },
  { key: "fire", vocabularyIds: ["34f42a72-9b02-476c-8d86-49c05742f513"], tags: ["illustration", "ren-linje", "tal"] },
  { key: "fem", vocabularyIds: ["a1ec1dbc-8fef-42e1-b8c6-0e3aa0e7ba08"], tags: ["illustration", "ren-linje", "tal"] },

  { key: "blaa", vocabularyIds: ["7872d982-4338-42b6-b252-8295d753bc50"], tags: ["illustration", "ren-linje", "farver"] },
  { key: "groen", vocabularyIds: ["268a9b54-5265-454c-ab0a-f6be3f60bcd9"], tags: ["illustration", "ren-linje", "farver"] },
  { key: "gul", vocabularyIds: ["74931df7-4500-48c5-96e0-8c7cd766cf96"], tags: ["illustration", "ren-linje", "farver"] },
  { key: "roed", vocabularyIds: ["e50c8d8e-29dc-4e87-aeea-709825edb0d4"], tags: ["illustration", "ren-linje", "farver"] },
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
    hint: failed.length > 0 ? "Kald funktionen igen — allerede uploadede springes over." : "Alle ord i denne kørsel har nu billede ✓",
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
