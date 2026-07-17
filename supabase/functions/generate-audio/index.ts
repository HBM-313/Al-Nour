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
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — flersproget premade
const MODEL_ID = "eleven_multilingual_v2"; // understøtter arabisk

interface WorkItem {
  table: "letters" | "vocabulary";
  id: string;
  text: string;
  filename: string;
  tag: string;
}

Deno.serve(async (req) => {
  // --------------------------------------------------------------------------
  // Adgangskontrol: kun service-nøglen (fail-closed)
  // --------------------------------------------------------------------------
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return json({ error: "Kræver service-nøglen (Authorization: Bearer …)" }, 401);
  }

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
  const voiceId = Deno.env.get("TTS_VOICE_ID") || DEFAULT_VOICE;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const db = createClient(supabaseUrl, serviceKey);

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
  const [lettersRes, vocabRes] = await Promise.all([
    db
      .from("letters")
      .select("id, position, name_ar, name_da")
      .is("audio_media_id", null)
      .order("position"),
    db
      .from("vocabulary")
      .select("id, word_ar, transliteration")
      .is("audio_media_id", null)
      .order("category"),
  ]);
  if (lettersRes.error) return json({ error: lettersRes.error.message }, 500);
  if (vocabRes.error) return json({ error: vocabRes.error.message }, 500);

  const work: WorkItem[] = [
    ...(lettersRes.data ?? []).map((l) => ({
      table: "letters" as const,
      id: l.id as string,
      text: l.name_ar as string,
      filename: `letters/${String(l.position).padStart(2, "0")}-${l.id}.mp3`,
      tag: "letters",
    })),
    ...(vocabRes.data ?? []).map((w) => ({
      table: "vocabulary" as const,
      id: w.id as string,
      text: w.word_ar as string,
      filename: `vocab/${w.id}.mp3`,
      tag: "vocabulary",
    })),
  ];

  const batch = work.slice(0, limit);
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const item of batch) {
    try {
      // 1. Generér lyd hos ElevenLabs
      const ttsRes = await fetch(
        `${ELEVENLABS_URL}/${voiceId}?output_format=mp3_44100_128`,
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
          tags: ["tts", "elevenlabs", item.tag],
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

      // 4. Kobl på bogstav/ord (letters-triggeren validerer mediet)
      const upd = await db
        .from(item.table)
        .update({ audio_media_id: media.data.id })
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
