/**
 * generate-audio — server-side TTS-generator (ElevenLabs).
 *
 * Genererer lydklip for alle bogstaver (name_ar) og ordforrådsord (word_ar)
 * der endnu ikke har en lydfil, uploader til Storage-bucket 'audio' og
 * kobler dem på via media-tabellen. Herefter hører ALLE enheder samme
 * arabiske udtale — browser-TTS bliver ren nødløsning (lyd-kæden i appen
 * foretrækker automatisk filen).
 *
 * LYD-REGLEN (2026-07-14): AI-lyd er tilladt for bogstaver/ord.
 * Alt markeres generated_by='ai', is_recitation=false. Quran-muren
 * (media_ai_never_recitation + trg_letters_audio_valid) håndhæves fortsat
 * af databasen selv — denne funktion KAN ikke omgå den.
 *
 * Adgang: kræver Authorization: Bearer <SERVICE_ROLE_KEY>. Anon-nøglen
 * afvises — ellers kunne enhver bruger brænde TTS-kvoten af.
 *
 * Hemmeligheder (Supabase → Edge Functions → Secrets):
 *   TTS_API_KEY   — ElevenLabs-nøgle (kun Text to Speech-adgang)
 *   TTS_VOICE_ID  — valgfri; standard er en varm flersproget stemme
 *
 * Kald: POST med valgfri JSON-body { "limit": 20 } (standard 20 pr. kald,
 * så funktionen holder sig langt under tidsgrænsen). Gentag kaldet til
 * "remaining" er 0 — allerede genererede springes over (idempotent).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const MODEL_ID = "eleven_multilingual_v2"; // understøtter arabisk

// To stemmer (ejer-beslutning): pige-bruger hører Habibah, dreng Ahmed.
// Kan overstyres via Secrets uden ny deploy (fx hvis en stemme viser sig
// at kræve betalt plan): TTS_VOICE_ID_FEMALE / TTS_VOICE_ID_MALE.
const DEFAULT_VOICE_FEMALE = "w4LX7bK479eHGM1k15Em"; // "Habibah"
const DEFAULT_VOICE_MALE = "etJo0VNXVmjmd5XDR7lJ"; // "Ahmed"

interface WorkItem {
  table: "letters" | "vocabulary";
  id: string;
  text: string;
  column: "audio_media_id" | "audio_media_id_male";
  voiceId: string;
  filename: string;
  tags: string[];
}

/**
 * Er nøglen i Authorization-headeren en service_role-nøgle?
 * Primært: match mod SUPABASE_SERVICE_ROLE_KEY (sat automatisk i de fleste
 * projekter). Fallback: læs 'role'-claimet direkte ud af JWT-payloaden —
 * nødvendigt fordi miljøvariablen ikke altid er tilgængelig for Edge
 * Functions afhængigt af projekt-opsætning. Signaturen valideres ikke her,
 * men enhver forespørgsel bruger nøglen som Supabase-service-nøgle
 * efterfølgende, så en forfalsket JWT afvises alligevel af databasen.
 */
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

Deno.serve(async (req) => {
  // --------------------------------------------------------------------------
  // Adgangskontrol: kun service-nøglen (fail-closed)
  // --------------------------------------------------------------------------
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const authHeader = (req.headers.get("authorization") ?? "").trim();
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!bearer || !isServiceRoleToken(bearer, serviceKey)) {
    return json({ error: "Kræver service-nøglen (Authorization: Bearer …)" }, 401);
  }
  // Fra nu bruges den indsendte nøgle (ikke kun env-variablen) til DB-klienten,
  // så adgangen fungerer uanset om SUPABASE_SERVICE_ROLE_KEY er sat i miljøet.
  const effectiveServiceKey = serviceKey || bearer;

  const ttsKey = Deno.env.get("TTS_API_KEY");
  if (!ttsKey) {
    return json(
      {
        error:
          "TTS_API_KEY mangler. Tilføj den i Supabase → Edge Functions → Secrets.",
      },
      500,
    );
  }
  const voiceFemale =
    Deno.env.get("TTS_VOICE_ID_FEMALE") || DEFAULT_VOICE_FEMALE;
  const voiceMale = Deno.env.get("TTS_VOICE_ID_MALE") || DEFAULT_VOICE_MALE;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const db = createClient(supabaseUrl, effectiveServiceKey);

  let limit = 20;
  try {
    const body = await req.json();
    if (typeof body?.limit === "number" && body.limit >= 1 && body.limit <= 40) {
      limit = Math.floor(body.limit);
    }
  } catch {
    // Tom body er fint — standard-limit bruges.
  }

  // --------------------------------------------------------------------------
  // Find arbejde: alt uden lydfil (idempotent — kørte klip springes over)
  // --------------------------------------------------------------------------
  // Begge stemmespor pr. element: kvinde (audio_media_id, standard) og
  // mand (audio_media_id_male). Kun manglende spor genereres (idempotent).
  const [lettersRes, vocabRes] = await Promise.all([
    db
      .from("letters")
      .select("id, position, name_ar, audio_media_id, audio_media_id_male")
      .or("audio_media_id.is.null,audio_media_id_male.is.null")
      .order("position"),
    db
      .from("vocabulary")
      .select("id, word_ar, audio_media_id, audio_media_id_male")
      .or("audio_media_id.is.null,audio_media_id_male.is.null")
      .order("category"),
  ]);
  if (lettersRes.error) return json({ error: lettersRes.error.message }, 500);
  if (vocabRes.error) return json({ error: vocabRes.error.message }, 500);

  const work: WorkItem[] = [];
  for (const l of lettersRes.data ?? []) {
    const base = `letters/${String(l.position).padStart(2, "0")}-${l.id}`;
    if (l.audio_media_id === null) {
      work.push({
        table: "letters", id: l.id as string, text: l.name_ar as string,
        column: "audio_media_id", voiceId: voiceFemale,
        filename: `${base}-f.mp3`, tags: ["tts", "elevenlabs", "letters", "voice:female"],
      });
    }
    if (l.audio_media_id_male === null) {
      work.push({
        table: "letters", id: l.id as string, text: l.name_ar as string,
        column: "audio_media_id_male", voiceId: voiceMale,
        filename: `${base}-m.mp3`, tags: ["tts", "elevenlabs", "letters", "voice:male"],
      });
    }
  }
  for (const w of vocabRes.data ?? []) {
    if (w.audio_media_id === null) {
      work.push({
        table: "vocabulary", id: w.id as string, text: w.word_ar as string,
        column: "audio_media_id", voiceId: voiceFemale,
        filename: `vocab/${w.id}-f.mp3`, tags: ["tts", "elevenlabs", "vocabulary", "voice:female"],
      });
    }
    if (w.audio_media_id_male === null) {
      work.push({
        table: "vocabulary", id: w.id as string, text: w.word_ar as string,
        column: "audio_media_id_male", voiceId: voiceMale,
        filename: `vocab/${w.id}-m.mp3`, tags: ["tts", "elevenlabs", "vocabulary", "voice:male"],
      });
    }
  }

  const batch = work.slice(0, limit);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const item of batch) {
    try {
      // 1. Generér lyd hos ElevenLabs
      const ttsRes = await fetch(
        `${ELEVENLABS_URL}/${item.voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ttsKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            text: item.text,
            model_id: MODEL_ID,
            voice_settings: { stability: 0.6, similarity_boost: 0.8 },
          }),
        },
      );
      if (!ttsRes.ok) {
        const msg = await ttsRes.text();
        results.push({ id: item.id, ok: false, error: `TTS ${ttsRes.status}: ${msg.slice(0, 160)}` });
        continue;
      }
      const audio = new Uint8Array(await ttsRes.arrayBuffer());

      // 2. Upload til Storage (offentlig kurrikulum-lyd, ingen persondata)
      const up = await db.storage
        .from("audio")
        .upload(item.filename, audio, {
          contentType: "audio/mpeg",
          upsert: true,
        });
      if (up.error) {
        results.push({ id: item.id, ok: false, error: `Upload: ${up.error.message}` });
        continue;
      }
      const publicUrl = db.storage.from("audio").getPublicUrl(item.filename)
        .data.publicUrl;

      // 3. media-række — LYD-REGLEN: ai + aldrig recitation. Databasens
      //    egne constraints/triggere validerer (kan ikke omgås herfra).
      const media = await db
        .from("media")
        .insert({
          type: "audio",
          url: publicUrl,
          tags: item.tags,
          generated_by: "ai",
          is_recitation: false,
          reusable: true,
        })
        .select("id")
        .single();
      if (media.error) {
        results.push({ id: item.id, ok: false, error: `media: ${media.error.message}` });
        continue;
      }

      // 4. Kobl på bogstav/ord i det rigtige stemmespor
      //    (letters-triggeren validerer mediet for begge spor)
      const upd = await db
        .from(item.table)
        .update({ [item.column]: media.data.id })
        .eq("id", item.id);
      if (upd.error) {
        results.push({ id: item.id, ok: false, error: `${item.table}: ${upd.error.message}` });
        continue;
      }

      results.push({ id: item.id, ok: true });
    } catch (e) {
      results.push({
        id: item.id,
        ok: false,
        error: e instanceof Error ? e.message : "ukendt fejl",
      });
    }
  }

  const generated = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return json({
    generated,
    failed: failed.length,
    failures: failed.slice(0, 5),
    remaining: work.length - batch.length + failed.length,
    hint:
      work.length - batch.length + failed.length > 0
        ? "Kald funktionen igen for at fortsætte."
        : "Alt har lyd nu ✓",
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}
