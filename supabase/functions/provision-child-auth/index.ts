/**
 * provision-child-auth — udsteder barnets egen auth.users-identitet (Leverance B1).
 *
 * Se plan-boernesession-og-dashboard.md, del 3 (mulighed A) og del 4 (B1).
 * Dette er KUN identitets-oprettelsen (auth-brugeren + profiles.auth_user_id).
 * Selve pin-login der udsteder en SESSION til barnet er Leverance B2 — denne
 * funktion udsteder aldrig en session, kun identiteten bag den.
 *
 * MUREN — læs før ændringer:
 *  - child-rollen tildeles UDELUKKENDE af custom_access_token_hook ud fra
 *    profiles.auth_user_id (sat her). Klienten kan aldrig sætte rollen selv.
 *  - Adgangskoden der genereres er kryptografisk tilfældig, bruges ÉN gang
 *    til at oprette auth-brugeren, og forlader ALDRIG denne funktion — den
 *    logges ikke, returneres ikke, gemmes ikke. Barnet logger aldrig ind med
 *    e-mail/adgangskode; det sker via dyre-pin (Leverance B2, ny session).
 *  - E-mailen er syntetisk (c-<profil-uuid>@child.nour.invalid, ".invalid"
 *    er reserveret af RFC 2606 og ruter aldrig nogen steder) og indeholder
 *    intet om barnet — GDPR-dataminimering, jf. planens vurdering.
 *
 * Adgang (fail-closed):
 *  1. Authorization-headeren skal være en GYLDIG bruger-JWT (forælder eller
 *     admin) — valideres kryptografisk via auth.getUser().
 *  2. JWT'ens user_role skal være 'parent' eller 'admin'.
 *  3. Selve profilen læses med KALDERENS JWT under RLS (profiles_owner_all)
 *     — en forælder kan derfor kun provisionere sine EGNE børn; RLS'en gør
 *     arbejdet, funktionen tilføjer ingen egen ejerskabs-logik.
 *
 * Idempotent: har profilen allerede auth_user_id, foretages intet nyt —
 * samme kald kan trygt gentages (fx ved netværksfejl).
 *
 * Hemmelighed (Supabase → Edge Functions → Secrets):
 *   CHILD_AUTH_SERVICE_ROLE_KEY — samme værdi som Project Settings → API →
 *   service_role. Sættes eksplicit, fordi SUPABASE_SERVICE_ROLE_KEY ikke
 *   pålideligt er til stede som auto-env i alle projekt-opsætninger (kendt
 *   fund fra generate-audio-sessionen). Funktionen prøver SUPABASE_
 *   -varianten først og falder tilbage til den eksplicitte hemmelighed.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kryptografisk tilfældig adgangskode. Bruges én gang, gemmes aldrig. */
function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Brug POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // --------------------------------------------------------------------------
  // Adgangskontrol: gyldig forælder/admin-JWT (IKKE service-nøglen)
  // --------------------------------------------------------------------------
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ error: "Kræver Authorization: Bearer <bruger-JWT>." }, 401);

  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
  if (userErr || !userData?.user) {
    return json({ error: "Ugyldig eller udløbet session. Log ind igen." }, 401);
  }

  const role = String(decodeClaims(bearer)?.user_role ?? "");
  if (role !== "parent" && role !== "admin") {
    return json({ error: "Kun forælder eller admin kan aktivere en barneprofil." }, 403);
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------
  let body: { profile_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ugyldig JSON i request-body." }, 400);
  }
  const profileId = (body.profile_id ?? "").trim();
  if (!UUID_RE.test(profileId)) {
    return json({ error: "profile_id skal være et gyldigt uuid." }, 400);
  }

  // --------------------------------------------------------------------------
  // Læs profilen med KALDERENS JWT — RLS (profiles_owner_all) afgør om
  // forælderen ejer barnet. Ingen egen ejerskabs-logik her: findes rækken
  // ikke for denne bruger, findes den (for dette kald) ikke.
  // --------------------------------------------------------------------------
  const callerDb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: profile, error: profileErr } = await callerDb
    .from("profiles")
    .select("id, auth_user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileErr) return json({ error: "Kunne ikke læse profilen." }, 500);
  if (!profile) return json({ error: "Profil ikke fundet, eller du har ikke adgang til den." }, 404);

  if (profile.auth_user_id) {
    return json({ success: true, already_provisioned: true, auth_user_id: profile.auth_user_id });
  }

  // --------------------------------------------------------------------------
  // Service-nøgle: kræves for at oprette en auth-bruger via Admin-API'et.
  // --------------------------------------------------------------------------
  const serviceKey =
    (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim() ||
    (Deno.env.get("CHILD_AUTH_SERVICE_ROLE_KEY") ?? "").trim();
  if (!serviceKey) {
    return json(
      {
        error:
          "CHILD_AUTH_SERVICE_ROLE_KEY mangler. Tilføj den i Supabase → Edge Functions → Secrets " +
          "(samme værdi som Project Settings → API → service_role).",
      },
      500,
    );
  }
  const adminClient = createClient(supabaseUrl, serviceKey);

  // --------------------------------------------------------------------------
  // Opret auth-brugeren. E-mail er syntetisk og ruter ingen steder (.invalid,
  // RFC 2606). Adgangskoden forlader aldrig denne funktion.
  // --------------------------------------------------------------------------
  const syntheticEmail = `c-${profileId}@child.nour.invalid`;
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: syntheticEmail,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { nour_child_profile: true },
  });

  if (createErr || !created?.user) {
    return json({ error: `Kunne ikke oprette barnets identitet: ${createErr?.message ?? "ukendt fejl"}` }, 502);
  }

  // --------------------------------------------------------------------------
  // Kobl profilen til den nye auth-bruger. WHERE ... auth_user_id is null
  // værner mod et samtidigt dobbelt-kald (idempotens under kapløb).
  // --------------------------------------------------------------------------
  const { data: updated, error: updateErr } = await adminClient
    .from("profiles")
    .update({ auth_user_id: created.user.id })
    .eq("id", profileId)
    .is("auth_user_id", null)
    .select("id, auth_user_id")
    .maybeSingle();

  if (updateErr) {
    // Ryd op i den forældreløse auth-bruger vi lige oprettede.
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: "Kunne ikke koble profilen til den nye identitet." }, 500);
  }

  if (!updated) {
    // Kapløb: en anden proces nåede at provisionere profilen først.
    // Ryd op i vores nu overflødige auth-bruger og returnér den vindende id.
    await adminClient.auth.admin.deleteUser(created.user.id);
    const { data: existing } = await adminClient
      .from("profiles")
      .select("auth_user_id")
      .eq("id", profileId)
      .maybeSingle();
    return json({ success: true, already_provisioned: true, auth_user_id: existing?.auth_user_id ?? null });
  }

  return json({ success: true, already_provisioned: false, auth_user_id: updated.auth_user_id });
});
