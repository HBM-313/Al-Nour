/**
 * child-signin — verificerer barnets dyre-pin og udsteder en RIGTIG session
 * (Leverance B2, plan-boernesession-og-dashboard.md del 4).
 *
 * Forudsætning: profilen skal allerede have en auth_user_id (sat af
 * provision-child-auth, Leverance B1/session 15 — forælderens "Aktivér egen
 * adgang"-knap). Uden den kan barnet ikke logge ind endnu; funktionen svarer
 * pænt og beder om at spørge en voksen.
 *
 * MUREN — læs før ændringer:
 *  - Rate limiting + selve pin-verifikationen sker ATOMISK i databasen
 *    (public.attempt_child_pin), IKKE her i funktionen. Denne funktion har
 *    ingen egen forsøgs-logik at holde synkron med databasen.
 *  - verify_child_pin (den gamle, statsløse boolean-RPC) er BEVIDST låst
 *    ned (revoke fra anon/authenticated) — den var en ubegrænset gætte-
 *    oracle uden rate limiting, som ville have gjort hele denne funktions
 *    rate limiting virkningsløs. attempt_child_pin/child-signin er nu den
 *    ENESTE vej til at verificere en pin. Lås ALDRIG verify_child_pin op
 *    igen for anon/authenticated uden at genindføre rate limiting der.
 *  - Adgangskoden bag barnets auth-bruger forlader ALDRIG denne funktion
 *    (den kender den ikke engang — kun provision-child-auth satte den, én
 *    gang, og glemte den straks). Sessionen udstedes i stedet via Supabase's
 *    admin generateLink ("magiclink"), som klienten selv indløser med
 *    supabase.auth.verifyOtp() — service-nøglen forlader aldrig denne funktion.
 *    VIGTIGT: klienten skal indløse med `token_hash`-varianten, ikke
 *    `{ email, token }` — se useAppShell.completeChildSignin.
 *  - Et forkert pin-forsøg giver ALDRIG lockout, kun stigende forsinkelse
 *    (se attempt_child_pin). "hent en voksen"-beskeden er en frontend-
 *    beslutning baseret på attempt_count >= 5, som denne funktion blot
 *    videregiver.
 *  - Ulåst profil (intet pin sat, bevidst ejer-beslutning) logger altid ind
 *    med ét tryk — attempt_child_pin håndhæver aldrig rate limit for den.
 *    Klienten kender allerede (fra profiles.pin_hash i den RLS-hentede
 *    profilliste) om profilen er ulåst, og kan derfor sende en TOM sekvens
 *    i det tilfælde — attempt_child_pin ignorerer indholdet når pin_hash
 *    er null, så en tom sekvens er lige så gyldig som enhver anden.
 *
 * Adgang: verify_jwt=true betyder blot en GYLDIG Supabase-JWT (anon-nøglen
 * client-SDK'et selv vedhæfter er gyldig) — IKKE et krav om forælder/admin,
 * fordi barnet pr. definition endnu ikke er logget ind når dette kaldes.
 * Selve identiteten bevises af pin'en, ikke af den indkommende JWT.
 *
 * Hemmelighed: CHILD_AUTH_SERVICE_ROLE_KEY (samme som provision-child-auth).
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Venlige, danske, børnesikre fejlbeskeder — aldrig teknisk jargon. */
const MESSAGES = {
  badInput: "Det ser ikke helt rigtigt ud. Prøv igen.",
  wrong: "Det var ikke helt rigtigt. Prøv igen.",
  wait: "Vent lidt, og prøv igen om et øjeblik.",
  notReady: "Denne profil er ikke helt klar endnu. Bed en voksen om at aktivere adgang i forældre-portalen.",
  serverIssue: "Noget gik galt. Prøv igen om lidt.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Brug POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  let body: { profile_id?: string; sequence?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: MESSAGES.badInput }, 400);
  }

  const profileId = (body.profile_id ?? "").trim();
  if (!UUID_RE.test(profileId)) {
    return json({ error: MESSAGES.badInput }, 400);
  }

  // Tom sekvens er gyldig (ulåst profil, se kommentar øverst) — men aldrig
  // for lang, og aldrig med tomme/for lange enkelt-elementer.
  const sequence = body.sequence;
  if (
    !Array.isArray(sequence) ||
    sequence.length > 8 ||
    !sequence.every((s) => typeof s === "string" && s.length > 0 && s.length <= 8)
  ) {
    return json({ error: MESSAGES.badInput }, 400);
  }

  // To mulige service-nøgler, og de er IKKE nødvendigvis lige gyldige.
  // Auth-admin-endpointet (/admin/generate_link) afviste 2026-07-24 den ene
  // med `bad_jwt: unrecognized JWT kid <nil> for algorithm ES256` — altså en
  // legacy-signeret nøgle mod et projekt der verificerer asymmetrisk. Fordi
  // SUPABASE_SERVICE_ROLE_KEY desuden ikke er pålideligt auto-injiceret her
  // (kendt fund fra generate-audio-sessionen), skiftede den brugte nøgle fra
  // kald til kald, og barnets login fejlede uforudsigeligt.
  //
  // Vi holder derfor begge kandidater og prøver dem i rækkefølge dér hvor
  // det viste sig at betyde noget (generateLink). PostgREST-kaldene nedenfor
  // accepterede begge nøgler, så de bruger blot den første.
  const serviceKeys = [
    ...new Set(
      [
        (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim(),
        (Deno.env.get("CHILD_AUTH_SERVICE_ROLE_KEY") ?? "").trim(),
      ].filter((k) => k.length > 0),
    ),
  ];
  if (serviceKeys.length === 0) {
    return json({ error: MESSAGES.serverIssue }, 500);
  }
  const adminClient = createClient(supabaseUrl, serviceKeys[0]);

  // --------------------------------------------------------------------------
  // Atomisk rate-tjek + pin-verifikation i databasen. Denne funktion har
  // ingen egen forsøgs-tælling at holde synkron.
  // --------------------------------------------------------------------------
  const { data: attemptResult, error: attemptErr } = await adminClient.rpc("attempt_child_pin", {
    p_profile_id: profileId,
    p_attempt: sequence,
  });

  if (attemptErr) {
    return json({ error: MESSAGES.serverIssue }, 500);
  }

  const status = (attemptResult as { status?: string })?.status;
  const waitSeconds = (attemptResult as { wait_seconds?: number })?.wait_seconds ?? 0;
  const attemptCount = (attemptResult as { attempt_count?: number })?.attempt_count ?? 0;

  if (status === "rate_limited") {
    return json(
      {
        error: MESSAGES.wait,
        wait_seconds: waitSeconds,
        attempt_count: attemptCount,
        ask_adult: attemptCount >= 5,
      },
      429,
    );
  }

  if (status === "invalid") {
    return json(
      {
        error: MESSAGES.wrong,
        wait_seconds: waitSeconds,
        attempt_count: attemptCount,
        ask_adult: attemptCount >= 5,
      },
      401,
    );
  }

  if (status !== "ok") {
    return json({ error: MESSAGES.serverIssue }, 500);
  }

  // --------------------------------------------------------------------------
  // Pin (eller mangel på pin) er godkendt. Slå auth_user_id op og udsted
  // en rigtig session via et engangs-magiclink-token.
  // --------------------------------------------------------------------------
  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("auth_user_id, display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (profileErr) {
    return json({ error: MESSAGES.serverIssue }, 500);
  }
  if (!profile?.auth_user_id) {
    return json({ error: MESSAGES.notReady, needs_provisioning: true }, 409);
  }

  const syntheticEmail = `c-${profileId}@child.nour.invalid`;

  // Prøv hver service-nøgle indtil auth-serveren accepterer én. Ved succes
  // med en anden nøgle end den første logges det (uden at afsløre nøglen),
  // så en forældet hemmelighed kan ryddes op bevidst i stedet for at leve
  // videre som en intermitterende login-fejl for et barn.
  let hashedToken: string | undefined;
  let lastLinkErr: unknown = null;
  for (let i = 0; i < serviceKeys.length; i++) {
    const client =
      i === 0 ? adminClient : createClient(supabaseUrl, serviceKeys[i]);
    const { data: link, error: linkErr } = await client.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
    });
    if (!linkErr && link?.properties?.hashed_token) {
      hashedToken = link.properties.hashed_token;
      if (i > 0) {
        console.warn(
          `child-signin: service-nøgle #${i} virkede, #0 blev afvist af auth — ryd op i den forældede hemmelighed.`,
        );
      }
      break;
    }
    lastLinkErr = linkErr;
  }

  if (!hashedToken) {
    console.error("child-signin: generateLink fejlede for alle service-nøgler", lastLinkErr);
    return json({ error: MESSAGES.serverIssue }, 500);
  }

  return json({
    success: true,
    email: syntheticEmail,
    token_hash: hashedToken,
    otp_type: "magiclink",
    display_name: profile.display_name,
  });
});
