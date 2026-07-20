/**
 * suggest-vocab — AI-ordforslag til Ordforråds-værkstedet (Leverance D).
 *
 * MUREN — læs før ændringer:
 *  - Denne funktion SKRIVER ALDRIG i databasen. Den returnerer kun forslag.
 *    Mennesket (admin/editor) gemmer hvert forslag som kladde fra klienten;
 *    DB-triggeren trg_vocab_ai_draft_only garanterer at AI-forslag ikke kan
 *    fødes udgivne. Refaktorér ALDRIG denne funktion til selv at indsætte.
 *  - Ordforråd er AI-tilladt indhold (sprog, ikke aqidah). Funktionen må
 *    aldrig genbruges til aqidah-indhold.
 *
 * Adgang (fail-closed):
 *  1. Authorization-headeren skal være en GYLDIG bruger-JWT — valideres
 *     kryptografisk via auth.getUser() (en forfalsket JWT afvises her,
 *     før der bruges ét eneste Claude-token).
 *  2. JWT'ens user_role-claim (sat af custom access token-hooken fra
 *     accounts.role) skal være 'admin' eller 'editor'.
 *
 * Dublet-værn (lag 1 af tre — ejer-krav):
 *  - Hele det eksisterende ordforråd (inkl. kladder, læst med kaldernes
 *    egen JWT under RLS) sendes med i prompten som "undgå disse".
 *  - Claudes svar EFTER-filtreres med normaliseret sammenligning
 *    (harakat strippet, hamza foldet) på både word_ar og word_da.
 *  (Lag 2: klienten filtrerer igen. Lag 3: vocabulary_word_ar_key UNIQUE.)
 *
 * Hemmeligheder (Supabase → Edge Functions → Secrets):
 *   ANTHROPIC_API_KEY — Claude API-nøgle (kun Messages-adgang nødvendig)
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

/** Spejler DB-CHECK'en vocabulary_category_check. */
const CATEGORIES = [
  "familie",
  "tal",
  "farver",
  "dyr",
  "mad",
  "krop",
  "hjem",
  "natur",
  "hilsner",
] as const;
type Category = (typeof CATEGORIES)[number];

const MAX_COUNT = 8;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // CORS: funktionen kaldes fra browseren via supabase.functions.invoke
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

/** Samme normalisering som klientens engine.ts — hold dem synkrone. */
function normalizeArabic(word: string): string {
  return (word ?? "")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/ة$/g, "ه")
    .trim();
}

function decodeClaims(bearer: string): Record<string, unknown> | null {
  try {
    const payloadB64 = bearer.split(".")[1];
    if (!payloadB64) return null;
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface Suggestion {
  word_ar: string;
  word_da: string;
  transliteration: string;
  emoji: string | null;
  level: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Brug POST." }, 405);

  // --------------------------------------------------------------------------
  // Adgangskontrol (fail-closed): gyldig JWT + admin/editor-rolle
  // --------------------------------------------------------------------------
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ error: "Kræver Authorization: Bearer <bruger-JWT>." }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
  if (userErr || !userData?.user) {
    return json({ error: "Ugyldig eller udløbet session. Log ind igen." }, 401);
  }

  const role = String(decodeClaims(bearer)?.user_role ?? "");
  if (role !== "admin" && role !== "editor") {
    return json({ error: "Kun admin/editor kan hente ordforslag." }, 403);
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------
  let body: { category?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ugyldig JSON i request-body." }, 400);
  }
  const category = body.category as Category;
  if (!CATEGORIES.includes(category)) {
    return json({ error: `Ukendt kategori. Gyldige: ${CATEGORIES.join(", ")}.` }, 400);
  }
  const count = Math.min(Math.max(Number(body.count) || 5, 1), MAX_COUNT);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      { error: "ANTHROPIC_API_KEY mangler. Tilføj den i Supabase → Edge Functions → Secrets." },
      500,
    );
  }

  // --------------------------------------------------------------------------
  // Eksisterende ordforråd (inkl. kladder) — læst med kaldernes JWT under RLS
  // --------------------------------------------------------------------------
  const db = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: existingRows, error: vocabErr } = await db
    .from("vocabulary")
    .select("word_ar, word_da");
  if (vocabErr) return json({ error: "Kunne ikke læse det eksisterende ordforråd." }, 500);

  const existing = existingRows ?? [];
  const existingAr = new Set(existing.map((w) => normalizeArabic(w.word_ar)));
  const existingDa = new Set(existing.map((w) => w.word_da.trim().toLowerCase()));

  // --------------------------------------------------------------------------
  // Claude: foreslå ord — undgå eksplicit alle eksisterende
  // --------------------------------------------------------------------------
  const avoidList = existing.map((w) => `${w.word_ar} (${w.word_da})`).join(", ");
  const prompt = [
    `Du hjælper en dansk/arabisk læringsplatform for børn (3-14 år) med at udvide sit ordforråd.`,
    `Foreslå ${count + 3} nye arabiske ord i kategorien "${category}".`,
    ``,
    `Krav til hvert ord:`,
    `- word_ar: moderne standardarabisk (fusha) med FULD vokalisering (harakat), fx "قِطّ".`,
    `- word_da: den danske betydning, kort og barnevenlig, med småt begyndelsesbogstav.`,
    `- transliteration: barnevenlig dansk-baseret transskription i stil med disse eksempler: umm, kalb, 'usfuur, khubz, tuffaaha (apostrof for ayn/hamza, dobbeltvokal for lang vokal).`,
    `- emoji: én enkelt emoji der bærer ordets betydning for små børn, eller null hvis ingen passer.`,
    `- level: 1 for helt basale ord, 2 for lidt sværere.`,
    ``,
    `Vælg konkrete, hverdagsnære ord et barn kan pege på eller genkende. Ingen religiøse eller teologiske begreber — kun almindeligt sprog.`,
    ``,
    `UNDGÅ disse ord, som allerede findes (foreslå heller ikke varianter/synonymer af dem): ${avoidList || "(ingen endnu)"}`,
    ``,
    `Svar KUN med et JSON-array, ingen forklaring, ingen markdown-hegn:`,
    `[{"word_ar":"...","word_da":"...","transliteration":"...","emoji":"...","level":1}]`,
  ].join("\n");

  let content: string;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Claude-kaldet fejlede (${res.status}).`, detail }, 502);
    }
    const data = await res.json();
    content = (data?.content ?? [])
      .filter((c: { type?: string }) => c?.type === "text")
      .map((c: { text?: string }) => c.text ?? "")
      .join("\n");
  } catch {
    return json({ error: "Claude-kaldet fejlede (netværk)." }, 502);
  }

  // --------------------------------------------------------------------------
  // Parse + validér + dublet-filtrér (lag 1)
  // --------------------------------------------------------------------------
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
  } catch {
    return json({ error: "Kunne ikke tolke Claudes svar. Prøv igen." }, 502);
  }
  if (!Array.isArray(parsed)) return json({ error: "Uventet svarformat fra Claude." }, 502);

  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  let filteredOut = 0;
  for (const item of parsed) {
    const s = item as Partial<Suggestion>;
    if (
      typeof s.word_ar !== "string" ||
      typeof s.word_da !== "string" ||
      typeof s.transliteration !== "string" ||
      !/[\u0600-\u06FF]/.test(s.word_ar)
    ) {
      continue;
    }
    const normAr = normalizeArabic(s.word_ar);
    const normDa = s.word_da.trim().toLowerCase();
    // Dubletter mod eksisterende ordforråd OG internt i svaret
    if (existingAr.has(normAr) || existingDa.has(normDa) || seen.has(normAr)) {
      filteredOut++;
      continue;
    }
    seen.add(normAr);
    suggestions.push({
      word_ar: s.word_ar.trim(),
      word_da: s.word_da.trim(),
      transliteration: s.transliteration.trim(),
      emoji: typeof s.emoji === "string" && s.emoji.trim() ? s.emoji.trim() : null,
      level: s.level === 2 ? 2 : 1,
    });
    if (suggestions.length >= count) break;
  }

  return json({ suggestions, filtered_out: filteredOut, category });
});
