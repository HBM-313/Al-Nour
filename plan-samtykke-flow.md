# Plan: Samtykke-flow & forælder-auth — næste session (skrevet 2026-07-18)
 
*Til næste session. Læg denne i projektmappen sammen med instruktion.md, SKILL.md og handoff.md. Læs alle fire før arbejdet starter. Denne plan afløser leverance 2–3 i plan-pin-login-port.md — leverance 1 er GENNEMFØRT.*
 
---
 
## Hvad er allerede gjort (verificér, gentag ikke)
 
**Leverance 1 afsluttet (commit `0241757`, pushet til main):**
- `features/pin-login/` er live i repoet: `PinLogin.tsx` (tre skind, profilvælger → dyre-pin → velkomst), `usePinLogin.ts` (state-maskine), `engine.ts` (ANIMAL_POOL-kontrakt + RPC-wrappere), `pin-login.css`, `index.ts`.
- `types.ts` synkroniseret med live-skema: `Profile.avatar` (text — dokumenteret afvigelse), `pin_hash`, `preferred_voice`; `Account.consent_given_at`/`consent_version`.
- `App.tsx` har demo-sektion der henter testprofilerne og viser PinLogin.
- Typecheck + oxlint + PWA-build grønne. Ejer-godkendt via simuleret demo.
**Testdata i live-DB (behold under udvikling, SLET før lancering):**
- Konto: `test-foraelder@nour.test`, account_id `8ace1757-72c6-4ff0-ba19-9dc4f52e5007` (findes i både `auth.users` og `accounts`, role 'parent').
- Profiler: Ali `b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42` (pin 0,1,2 = dyr 1-2-3), Zainab `94f698f3-9c50-4c0c-bf0a-00842a9530df` (pin 0,1,2,3 = dyr 1-2-3-4).
- RPC-vejen er verificeret direkte mod live-DB: korrekt pin ✓, forkert pin ✓, forkert rækkefølge ✓.
## Kritiske tekniske fund fra denne session (planens fundament)
 
1. **INGEN signup-trigger på `auth.users`** (verificeret via `pg_trigger`-query). En ny forælder der signer op via Supabase Auth får ALDRIG automatisk en `accounts`-række.
2. **`accounts` har ingen INSERT-policy for almindelige brugere** (kun `accounts_admin_all`, `accounts_select_own`, `accounts_update_own` — verificeret via `pg_policies`). En ny forælder kan altså heller ikke selv indsætte sin række client-side.
3. → **Første tekniske opgave:** vælg og byg mekanismen der opretter `accounts`-rækken ved signup. To muligheder (afvej i sessionen, foreslå én):
   - **(a) Postgres-trigger på `auth.users`** (`after insert`, SECURITY DEFINER): opretter accounts-række med role 'parent' automatisk. Robust, kan ikke glemmes af klienten. OBS: skal være fail-safe så en trigger-fejl ikke blokerer selve signup.
   - **(b) SECURITY DEFINER-RPC** (fx `ensure_parent_account()`) som klienten kalder efter første login: opretter rækken hvis den mangler, `auth.uid()` som id, role altid 'parent' (aldrig klient-valgt). Mere eksplicit, nemmere at teste.
   - Uanset valg: **role må ALDRIG kunne sættes af klienten** — hardcode 'parent'. Admin/editor/approver tildeles kun manuelt af ejeren via dashboard.
4. **`accounts.id` er FK til `auth.users(id)` med ON DELETE CASCADE** — sletning af auth-bruger rydder accounts-rækken. Tjek tilsvarende cascades fra `profiles` → `progress`/`class_members` FØR sletning implementeres (GDPR ét-kliks-sletning).
5. **`profiles_owner_all`-policyen dækker allerede** forælderens CRUD på egne børneprofiler — profil-oprettelse kræver ingen ny policy.
6. **pgcrypto bor i `extensions`-schemaet** — al SQL med `crypt()`/`gen_salt()` skrives fuldt kvalificeret (`extensions.crypt(...)`).
7. **Artifact-miljøet i chatten blokerer netværkskald til Supabase (CSP).** Demoer med live DB-kald virker IKKE som artifact — byg demoer med simuleret backend (samme UI/flow/testdata), og verificér RPC/DB-vejen separat via SQL mod live-DB. Dette er nu det etablerede mønster.
## Sessionens leverancer (i rækkefølge, ejer-godkendelse imellem)
 
### Leverance A: Signup-mekanisme + forælder-auth i appen
 
1. **Migration** (idempotent, efter skema-drift-tjek på live-DB): den valgte signup-mekanisme fra fund 3, med mur-stil regression-tests (`DO $$`-blokke, `set_config('request.jwt.claims', ...)`, terminal `RAISE EXCEPTION 'ROLLBACK_MARKER'`). Testdækning mindst: ny bruger får accounts-række med role 'parent' ✓; klient kan ikke give sig selv anden role ✓; eksisterende bruger påvirkes ikke ✓.
2. **Frontend `features/parent-auth/`:** email+password signup/login via `supabase.auth` (dansk UI, samme design-tokens). Efter login: kald/verificér accounts-rækken. Simpelt og lukket — ingen tredjeparts-OAuth i første omgang (dataminimering, GDPR-enkelhed).
3. Session-håndtering: `supabase.auth.onAuthStateChange` → app-state med aktiv forælder. Forælder-UI og børne-UI (PinLogin) er adskilte indgange.
### Leverance B: Samtykke-skærm
 
1. **Claude skriver udkast** til letforståelig dansk samtykke-/privatlivstekst (retsgrundlag: forældresamtykke, plan §13; dataminimering: kun kaldenavn + fødselsår + avatar; ét-kliks sletning; EU-hosting; ingen tracking/reklame). **Ejeren GODKENDER ordlyden før den går i UI.** Claude er ikke jurist — sig det eksplicit og anbefal juridisk gennemsyn før offentlig lancering.
2. Samtykke-skærm vises efter første login, FØR første barneprofil kan oprettes. Ved accept: `update accounts set consent_given_at = now(), consent_version = 'v1-2026-07' where id = auth.uid()` (via eksisterende `accounts_update_own`-policy — ingen ny migration nødvendig, men verificér at policyen tillader netop disse kolonner).
3. Uden samtykke: ingen adgang til profil-oprettelse. Allerede-givet samtykke (felt udfyldt) springer skærmen over.
### Leverance C: Opret barneprofil-formular
 
- Felter: kaldenavn + fødselsår + avatar + valgfrit pin. INTET andet felt (dataminimering).
- Pin sættes via `supabase.rpc('set_child_pin', ...)` — ALDRIG direkte kolonneskrivning. Genbrug dyre-grid'et fra `features/pin-login/` (samme ANIMAL_POOL, samme pool-index-kontrakt) til pin-valget, med "vælg igen for at bekræfte"-trin.
- `preferred_voice` vælges ved oprettelse (default 'female').
- Avatar-valg: afvent ejer-beslutning (åbent spørgsmål 3 nedenfor).
### Leverance D (kun hvis tid): Forældre-dashboard-skelet
 
- Liste over egne børneprofiler; opret (→ leverance C-formular); slet med bekræftelse (ét-kliks GDPR-sletning af barn + AL data — verificér cascades fra fund 4 FØRST og skriv dem eksplicit i migration hvis de mangler); se fremskridt pr. barn (genbrug `progress`-læsning).
- Mål-sætning/transskriptions-styring venter til senere.
## Hårde krav (uændret)
 
- RLS fail-closed som muren; `ai_service` nul adgang til persondata; role aldrig klient-styret.
- Skema-drift tjekkes på live-DB FØR migrationer (`pg_trigger`, `pg_policies`, `pg_constraint`, `information_schema.columns`).
- Idempotente migrationer med guards; mur-stil regression-tests der efterlader 0 rækker.
- Ingen eksterne links/køb i børne-tilstand; forælder-flowet er adskilt fra børne-UI.
- Kirurgiske ændringer; fuld kørbar kode; typecheck/oxlint/PWA-build grønne før push.
- Demo → ejer-test → godkendelse → port/push. Demoer SIMULERER backend (fund 7).
- Svar på dansk; ét konkret næste skridt ad gangen; alle spørgsmål som klikbare valgmuligheder.
## Sikkerheds-oprydning (ejer-handlinger, påmind i sessionen)
 
- **GitHub-token:** ligger i handoff.md OG er brugt i chat 2026-07-18 → ROTÉR, og fjern det fra handoff.md (filen anbefaler det selv). Nyt token indsættes kun i chat pr. session.
- Anon-nøglen blev delt i chat — den er offentlig by design (beskyttet af RLS), ingen handling nødvendig, men bekræft at RLS-testene dækker den.
- Testkontoen (`test-foraelder@nour.test` + Ali/Zainab) slettes før lancering.
## Åbne spørgsmål til ejeren (spørg som klikbare valgmuligheder, antag ikke)
 
1. **Gæste-tilstand:** permanent ved siden af profiler, eller kun "prøv uden konto"-indgang med opfordring til forældreopsætning?
2. **Samtykke-tekstens ordlyd:** udkast leveres i sessionen til godkendelse (leverance B.1).
3. **Avatar-valg til børneprofilen:** emoji-liste (som testprofilerne bruger nu) eller vent på illustrationsstil-beslutningen?
4. **Signup-mekanisme (fund 3):** trigger (a) eller RPC (b)? Claude foreslår med begrundelse; ejeren beslutter.
## Første konkrete skridt i sessionen
 
Tjek live-DB for drift siden 2026-07-18 (`pg_trigger` på auth.users, `pg_policies` på accounts) → foreslå signup-mekanisme (spørgsmål 4) → skriv migrationen med regression-tests → derefter leverance A frontend.
 
