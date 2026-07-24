# Migrationer

- `0001–0003`: reference-design fra planlægningen.
- `20260713193405_fase0_aqidah_mur_haerdet.sql`: deployeret hærdning af muren.
- `20260713_content_udvid_mod_0001.sql`: deployeret 2026-07-13 — lukkede
  skema-driften ved at udvide live `content` mod 0001-designet (title_da/ar,
  sacred_representation, tre aldersvarianter, declarative aqidah-constraints,
  indexes). Verificeret med testserie (se filens header).

**Status:** live `content` matcher nu 0001-designet. Bevidste, blivende
afvigelser fra 0001 andre steder: accounts.id = auth.uid() (ingen separat
auth_user_id), profiles.avatar er text (ikke FK), characters har egen
sacred_representation-kolonne med check <> 'light', media.type inkluderer
'illustration'. Disse betragtes som forbedringer og skal IKKE "rettes" mod 0001.


## Lyd-reglen lempet (ejer-beslutning 2026-07-14)

`20260714_fase1_lydregel_lempet.sql` erstatter `trg_letters_audio_human` med
`trg_letters_audio_valid`. Ny regel: **al lyd må være TTS/AI eller uploadet
fil — kun Quran-recitation skal være menneskelig** (`media_ai_never_recitation`
består). Bogstavlyd må aldrig være recitation-markeret, og ukendte medier
afvises stadig fail-closed. Dette er en bevidst lempelse, ikke drift — skal
IKKE rulles tilbage. Ældre kommentarer om "kerne-fusha = human-only" i
tidligere migrationsfiler er historiske.


## Profiler/auth (2026-07-18)

`20260718124834_fase1b_profiler_pin_samtykke.sql` og
`20260718195511_fase1c_signup_rpc_rollebeskyttelse_access_token_hook.sql`
var begge deployeret direkte mod live-DB via MCP i deres respektive sessioner,
men manglede som filer i repoet indtil retroaktivt tilføjet her — hold øje
med dette mønster: **en migration er ikke "færdig" før den er committet**,
ikke kun anvendt.

**Kritisk fund lukket i fase1c:** `accounts_update_own`-policyen havde ingen
`WITH CHECK`, så en almindelig forælder kunne sætte sin egen `role='admin'`
via en direkte UPDATE (bevist med test, rullet tilbage). Lukket med en
`BEFORE UPDATE`-trigger (`trg_accounts_protect_role`).

**Bevidst bootstrap-undtagelse — læs før du "rydder op":** triggeren tillader
rolle-/id-ændringer når `current_user = 'postgres'` (dvs. direkte SQL-adgang
via Dashboard/MCP), uafhængigt af `auth_user_role()`. Dette er IKKE et
tilbageværende hul — det er den eneste vej til at bootstrappe den allerførste
admin-konto, fordi ingen konto havde `role='admin'` da triggeren blev
indført, og triggeren ellers ville have låst alle ude permanent. Den
klient-vendte vej (authenticated/anon/service_role via PostgREST) er fuldt
blokeret. Fremtidige rolle-forfremmelser (Fase C admin-dashboard) bør gå
via en dedikeret admin-kun RPC, ikke via denne bagdør.

**Access Token Hook:** `custom_access_token_hook` synkroniserer
`accounts.role` ind i JWT'ets `user_role`-claim ved token-udstedelse/refresh.
Funktionen er en del af migrationen, men selve *aktiveringen* sker i
Supabase Dashboard (Authentication → Hooks → Custom Access Token) — det kan
ikke gøres via SQL/MCP. Aktiveret 2026-07-18.


## Historiernes Bjerge — redaktør-aqidah-kladde (2026-07-20)

`20260720_historier_redaktoer_aqidah_kladde.sql`: før denne migration havde
redaktør-rollen **nul** skriveret til aqidah-rækker (kun `approver`/`admin`
kunne overhovedet indsætte en kladde) — strengere end plan-dokumentets §9,
som løst beskriver redaktøren som en der "opretter/redigerer" indhold og kun
er afskåret fra *udgivelse*. Ejer-beslutning 2026-07-20: løsn muren så
redaktør kan oprette og redigere **uverificerede** aqidah-kladder (med
obligatorisk kildehenvisning), men aldrig selv kilde-verificere eller udgive.

Håndhæves i to uafhængige lag (bevidst redundans, samme filosofi som resten
af muren): RLS-politikkernes USING-genbrug som WITH CHECK, OG triggerens nye
Lag D (`enforce_aqidah_wall`). Hvis det ene lag fejler, holder det andet.
Bevist med 9-punkts rollback-markør-regressionstest — se migrationsfilens
header for den fulde liste. **Denne lempelse er bevidst og skal IKKE
rulles tilbage** — den er en forudsætning for Historie-værkstedet
(`features/historie-vaerksted/`).


## Historiernes Bjerge — barnets side + quiz_da (2026-07-21)

`20260721_historier_quiz_da.sql`: tilføjer `content.quiz_da` (jsonb,
nullable, `content_quiz_da_is_array`-constraint). Rent datafelt — ingen ny
RLS-politik eller trigger-ændring, fordi aqidah-muren allerede opererer på
RÆKKE-niveau og derfor automatisk dækker enhver ny kolonne på `content`.

Samtidig portet: `features/historiernes-bjerge/` (barnets visning af
udgivne, kilde-verificerede fortællinger — lys-illustration, kilde-mærke,
valgfri "hvad husker du"-quiz) og `WorldMap.tsx`/`AppShell.tsx` wired til
at åbne den. Begge sidstnævnte filer har en bevidst arkitekturregel om
ALDRIG at læse `content`/aqidah selv (se deres respektive header-
kommentarer) — derfor tjekker WorldMap ikke "er der en udgivet historie"
via en database-forespørgsel; regionen regnes for "vågen" i UI'et så
snart `onOpenHistorier` er wired, og det er selve
`historiernes-bjerge/engine.ts`, der viser en venlig tom-tilstand hvis der
endnu ikke findes nogen udgivet fortælling.

Historie-værkstedet (`features/historie-vaerksted/`) har endnu intet UI
til at indtaste `quiz_da` — det er en separat, kommende leverance. Indtil
da vises fortællinger uden quiz-sektion (feltet er nullable, ikke krævet
for udgivelse).


## `record_progress`-RPC + event-idempotens (2026-07-22)

`20260722_record_progress_atomic_rpc.sql`: Leverance 1.2
(plan-platformsmodning.md §1.2). `progress.ts` lavede tidligere
læs-derefter-skriv uden transaktion — to faner eller en kø-genafspilning
kunne tabe xp eller ødelægge streak. Erstattet af én atomisk
`INSERT ... ON CONFLICT DO UPDATE` i `record_progress()`.

**Vigtigt design-fund undervejs:** den faktiske `progress.ts` sender xp som
**delta pr. runde** (lægges til eksisterende), ikke kumulativ tilstand. En
første version af RPC'en antog fejlagtigt kumulativ tilstand og brugte
`GREATEST()`-merge — forkastet inden porting, aldrig brugt i produktion.
Additiv xp kan ikke gøres replay-sikker med `GREATEST()`, så løsningen blev
en ny tabel `progress_events(event_id uuid primary key, ...)`: hvert kald
til `record_progress` bærer et `event_id`; ses samme id igen (kø-replay
efter afbrudt forbindelse i Leverance 1.1), er kaldet et bevidst no-op —
ingen dobbelt-xp. `progress_events` har RLS slået til med **ingen
policies** (fail-closed) — kun selve RPC'en (SECURITY DEFINER) rører den.

Streak-reglen (samme dag → uændret; i går → +1; ellers → 1) og
step-nulstilling ved fuldførelse er flyttet uændret fra `progress.ts` ind i
RPC'en — **ikke** rettet til global streak (det er stadig
`UNIQUE(profile_id, lesson_id)`-begrænset); det er Leverance 1.3.

Bevist med 11-punkts rollback-markør-regressionstest mod live-DB (0 rækker
persisteret bagefter, verificeret): initial-gem, additiv xp over flere
runder, event-idempotens (ingen dobbelt-xp ved replay), fuldførelse
nulstiller step til 0, streak "i går → +1", streak-hul (≥2 dage) → nulstil
til 1, negativ xp afvist, manglende event_id afvist, fremmed bruger afvist,
uautentificeret kald afvist, samme forælder kan skrive begge egne børns
fremskridt.

Frontend (`lib/progress.ts`) porteret samtidig: `saveRoundProgress`/
`saveStepProgress` har uændrede eksterne signaturer (alle fire kaldsteder —
Lyt & Find, Tegn Bogstavet, Match-par, `useLesson` — er urørte), men kalder
nu `record_progress`-RPC'en med et auto-genereret `event_id` i stedet for
select+upsert. Den kommende IndexedDB-kø (Leverance 1.1) skal give sit eget
holdbare `event_id` med, så idempotensen også dækker offline-genafspilning.


## Global streak — `profiles.streak_count` (2026-07-22)

`20260722_global_streak_profiles.sql`: Leverance 1.3
(plan-platformsmodning.md §1.3). Streak lå hidtil på `progress` med
`UNIQUE(profile_id, lesson_id)` — altså én streak PR LEKTION. Et barn der
spiller trofast hver dag, men skifter lektion, oplevede at streaken evigt
viste "1". Rettet ved at flytte streak til `profiles` (ét barn = én
streak): nye kolonner `profiles.streak_count` (int, default 0,
`check (streak_count >= 0)`) og `profiles.last_active_day` (date, IKKE
timestamptz — undgår tidszonefejl ved dags-sammenligning).

**ARKITEKTUR-BESLUTNING (bevidst, ikke en rettelse af en fejl):**
`progress.streak_count` **fryses** fra denne migration. Kolonnen fjernes
ikke — den bevares som historisk/audit-felt med de værdier den havde ved
udgangen af Leverance 1.2 — men `record_progress()` sætter og opdaterer
den ikke længere. Nye `progress`-rækker får kolonnens default (`0`);
eksisterende rækkers værdier røres ikke. Al streak-visning i frontend skal
fremover læse `profiles.streak_count`, aldrig `progress.streak_count`.
Alternativet (udfase/droppe kolonnen helt) blev fravalgt for at undgå en
destruktiv migration oven på en leverance der i forvejen handler om at
undgå datatab.

`record_progress()` låser nu profil-rækken (`for update`) FØRST, i samme
`select` som autorisationstjekket (samme mønster som hidtil: kun
`owner_account_id = auth.uid()` eller `admin`). Det er en bevidst ændring
af låserækkefølgen: streak er global, så to samtidige kald for samme barn
(to faner, to forskellige lektioner) skal serialiseres på PROFIL-niveau —
den gamle lås på `progress`-rækken (via `UNIQUE(profile_id, lesson_id)`)
er ikke længere nok, fordi streak ikke længere hænger på den specifikke
lektion-række.

Streak-reglen er uændret i sin logik, blot flyttet fra
`progress.last_completed_at`/`progress.streak_count` til
`profiles.last_active_day`/`profiles.streak_count`: samme dag → uændret;
i går → +1; ellers (eller intet tidligere fremskridt) → 1.

Bevist med 8-punkts rollback-markør-regressionstest mod live-DB (0 rækker
persisteret bagefter, verificeret): første fuldførelse → streak 1; samme
dag, ny lektion → streak IKKE fordoblet; "i går" → +1; hul på ≥2 dage →
nulstil til 1; `progress.streak_count` forbliver frosset på `0` for nye
rækker; søskendes streak er uafhængige (Zainab upåvirket af Ali); samme
forælder kan skrive begge sine børns fremskridt; en uautoriseret bruger
afvises eksplicit med "ikke autoriseret".

Frontend porteret samtidig: `features/dashboard/engine.ts` læste tidligere
`Math.max(...progress.streak_count)` på tværs af lektioner ("bedste
streak") — det gav aldrig mening som en ægte streak og er nu erstattet af
et direkte read af `profile.streak_count`. Feltet i `ProgressSummary` er
omdøbt fra `bestStreak` til `streakCount`, fordi semantikken reelt ændrede
sig (ikke længere "bedste af flere", men "barnets ene, globale streak") —
`Dashboard.tsx` opdateret til samme navn. `features/app-shell/engine.ts`s
`migrateGuestProgress` (gæste-fremskridt → profil ved første login)
skrev tidligere `streak_count: 1` direkte på hver migreret `progress`-
række; det felt er nu droppet fra upsert'et (kolonnen er frosset — det
første rigtige `record_progress`-kald efter migreringen sætter
`profiles.streak_count` korrekt ud fra dags-reglen).


## delete_own_account() — GDPR: forælderen kan slette sin egen konto (2026-07-23)

`20260723_delete_own_account.sql`: Leverance 1.4 (plan-platformsmodning.md
§1.4). Barnets data kunne slettes med ét klik (Leverance D); forælderens
egen konto kunne ikke — der var ingen DELETE-policy på `accounts`. Art. 17
gælder også den voksne.

**Slette-graf kortlagt FØR migrationen** (fuld `pg_constraint`-scan af
public-schema, 2026-07-23): `auth.users` → `accounts` (CASCADE) →
`profiles` (CASCADE) → `progress`/`progress_events`/`class_members`
(CASCADE), samt `accounts` → `classes` (CASCADE, hvis kontoen er lærer) →
`class_members` (CASCADE). Alt dette var allerede korrekt sat op.

**FUND (hullet migrationen lukker):** fire kolonner pegede på `accounts`
med `ON DELETE NO ACTION`: `content.created_by`, `content.published_by`,
`content_reports.reporter_account_id`, `media.created_by`. Havde kontoen
(fx en redaktør/godkender, eller en forælder der har brugt en fremtidig
"noget er galt"-knap) oprettet/publiceret indhold eller rapporteret en
fejl, ville `delete_own_account()` være fejlet med en fremmednøgle-fejl —
sletningen ville simpelthen ikke lykkes. Alle fire kolonner er nullable,
så FK'erne er ændret til `SET NULL`: selve indholdet/rapporten er ikke
persondata og skal bevares; kun forfatter-referencen fjernes. Ingen
CHECK-constraint på `content`/`media` afhænger af disse kolonner —
aqidah-muren er urørt.

`error_log` har bevidst INGEN FK til `accounts`/`profiles` (dataminimering,
Leverance 0.2) — indgår derfor ikke i slette-grafen og kræver ingen
handling her.

**RPC-designet:** `delete_own_account()` tager ingen parametre — kontoen
der slettes er altid `auth.uid()`, aldrig en klient-valgt id. Selve
sletningen sker på `auth.users`-rækken; resten kaskaderer. SECURITY
DEFINER, ejet af `postgres` (som har DELETE-grant på `auth.users`), `grant
execute` kun til `authenticated` (samme mønster som `ensure_parent_account`).

**UDVIDELSESPUNKT for Leverance B3** (plan-boernesession-og-dashboard.md):
når børn får egne `auth.users`-rækker via `profiles.auth_user_id`, skal en
trigger på `profiles` DELETE slette den tilhørende barne-auth-bruger —
ellers efterlader `delete_own_account()` (og den eksisterende
ét-kliks-barnesletning) forældreløse børne-auth-brugere. Kommentaren
`UDVIDELSESPUNKT` i funktionens krop markerer præcis hvor. Indtil B1/B2 er
bygget, findes ingen børne-auth-brugere, så nuværende cascade er
tilstrækkelig.

**Beslutninger (ejer, klikbare valgmuligheder):** øjeblikkelig sletning
(ikke soft-delete/fortrydelsesperiode — stærkest GDPR-position, data må
ikke bestå efter en sletningsanmodning) · adgangskode-genindtastning
kræves i UI'et før kaldet (samme `signInWithPassword`-mønster som den
eksisterende forældre-port, `app-shell/engine.ts` → `verifyParentPassword`).

Bevist med rollback-markør-regressionstest mod live-DB, 0 rækker
persisteret: uautentificeret kald afvist · kryds-konto-isolation (konto B
sletter sig selv, konto A upåvirket) · fuld sletning af konto A efterlader
0 forældreløse rækker i `accounts`/`profiles`/`progress`/
`progress_events`/`class_members`/`classes` · en reel anden familie (Ali)
urørt. Testen brugte to engangs-testkonti, ikke `test-foraelder@nour.test`.

Frontend (`features/parent-auth/`): `Welcome`-visningen har fået en
diskret "Slet min konto"-handling under "Log ud", tilgængelig for alle
kontoroller (RPC'en skelner ikke — Art. 17 gælder uanset rolle). To-trins
overlay: (1) forklaring af konsekvenser, (2) adgangskode-genindtastning +
endelig bekræftelse. Efter succes: `supabase.auth.signOut()` rydder
klient-sessionen, og en rolig afsluttende skærm vises i stedet for straks
at falde tilbage til login-formularen.

---

## 20260723_child_identity_b1 — Leverance B1: barnets identitet i databasen

Se `plan-boernesession-og-dashboard.md`, del 3–4. Løser problemet at barnet
i dag spiller INDE I forælderens session (dyre-pin var kun en UI-port, ikke
en identitet). Valgt løsning: **mulighed A** — hver børneprofil kan få sin
egen `auth.users`-række med en syntetisk e-mail
(`c-<profil-uuid>@child.nour.invalid`, `.invalid` er RFC 2606-reserveret
og ruter aldrig nogen steder) og en kryptografisk tilfældig adgangskode
intet menneske nogensinde ser. Dette er KUN database-laget + hook + Edge
Function til selve provisioneringen. Pin-login der udsteder en RIGTIG
SESSION til barnet er Leverance B2 (næste session) — findes ikke endnu.

**Skema-drift-tjek FØR migrationen (2026-07-23):** intet ændret siden
`2ed0d1a` (Leverance 1.4). `auth_user_role()` bevist fail-closed for en
bruger uden `accounts`-række: returnerer `'anon'`, ikke `null` og ikke en
fejl (kørt direkte mod `custom_access_token_hook` med et opdigtet
`user_id`). `content`/`letters`/`vocabulary`/`lessons`s offentlige
læse-policies er alle rolle-uafhængige (`is_published = true` / `true`) —
et barn får derfor automatisk samme offentlige læseadgang som enhver
anden, uden ændringer.

**Hvad migrationen gør:**

1. `profiles.auth_user_id uuid unique references auth.users(id) on delete set null`
   — nullable indtil profilen aktiveres. `on delete set null` (ikke cascade):
   slettes auth-brugeren uden om den normale vej, mister profilen kun sit
   auth-link (kan re-provisioneres) — den normale vej er omvendt (slet
   `profiles` → trigger sletter auth-brugeren, se UDVIDELSESPUNKT nedenfor).

2. `custom_access_token_hook` udvidet med en `child`-gren: er der INGEN
   `accounts`-række for `event.user_id` (som hidtil gav `'anon'`), tjekkes nu
   `profiles.auth_user_id = event.user_id`. Findes en match, sættes
   `user_role: 'child'` + `profile_id: <uuid>` som claims. Er der en
   `accounts`-række, er den stadig den der afgør rollen (uændret forrang) —
   et barn har per definition ingen `accounts`-række, så rækkefølgen er
   reelt ligegyldig i praksis, men bevarer det eksisterende flow urørt.
   **Hård regel:** dette er den ENESTE kilde til `user_role='child'` —
   klienten kan aldrig fremtvinge det, kun service-rollen (via
   `provision_child_auth`) kan sætte `auth_user_id`.

3. `protect_profile_child_columns()` + trigger
   `trg_profiles_protect_child_columns` (BEFORE UPDATE, samme mønster som
   `protect_account_role_and_id`): når `auth_user_role() = 'child'`, blokerer
   triggeren enhver ændring af `id`, `owner_account_id`, `auth_user_id`,
   `display_name`, `avatar`, `birth_year`, `pin_hash`, `current_level`,
   `streak_count`, `last_active_day`. Kun `preferred_voice`,
   `transliteration_enabled`, `ui_language` (og `updated_at`, sat af den
   eksisterende `trg_profiles_updated_at`) er hvidlistede. RLS' `USING`/
   `WITH CHECK` kan ikke sammenligne mod OLD-rækken direkte — deraf
   trigger-mønstret. Bypass for `current_user = 'postgres'`: `record_progress()`
   (SECURITY DEFINER, ejet af `postgres`) skal fortsat kunne skrive
   streak/level på vegne af et barn.

4. RLS (additiv, rører ikke `profiles_owner_all`/`progress_owner_all`):
   `profiles_child_select_own` + `profiles_child_update_own` (begge
   `auth_user_role() = 'child' and auth_user_id = auth.uid()` — bevidst
   `auth.uid()`, den faktiske signerede bruger, IKKE `profile_id`-claimet;
   claimet er kun til brug i frontend/UX, aldrig som autorisationskilde) og
   `progress_child_select_own` (SELECT, samme mønster via join til
   `profiles`). Bevidst INGEN insert/update/delete-policy for `child` på
   `progress` — skrivning sker udelukkende via `record_progress()`,
   default-deny gælder ellers.

5. `record_progress()`: ejerskabstjekket (ét sted i funktionen) udvidet med
   en tredje vej: `auth_user_role() = 'child' and auth_user_id = auth.uid()`,
   ved siden af `owner_account_id = auth.uid()` og `auth_user_role() = 'admin'`.
   Kirurgisk ændring af WHERE-klausulen — resten af funktionen (idempotens,
   global streak) er uændret.

**Bevist med rollback-markør-regressionstest mod live-DB, 0 rækker
persisteret** (to engangs auth.users/profiles-testrækker "B1-Test-A/B",
IKKE Ali/Zainab/test-foraelder@nour.test — de er urørte, verificeret
separat efter testen): hook giver `child`+`profile_id` for et barn og
`anon` for en ukendt bruger ✓ · barn A kan læse egen profil ✓ · barn A kan
**ikke** læse søskendes profil (B) ✓ · barn A har **ingen** adgang til
`accounts` ✓ · barn A kan **ikke** ændre `pin_hash` eller flytte
`owner_account_id` (trigger blokerer) ✓ · barn A **kan** ændre
`preferred_voice` (hvidlistet) ✓ · barn A kan gemme eget fremskridt via
`record_progress` ✓ · barn A kan **ikke** gemme fremskridt på søskendes
profil (B) ✓ · forælderens session kan stadig alt uændret (læse begge
børn, opdatere `display_name`, kalde `record_progress`) — ingen regression
✓. `ai_service`s nul-adgang til `profiles`/`accounts`/`progress` bevist
separat via `has_table_privilege()` (ingen tabel-grants overhovedet,
uafhængigt af RLS) — uændret af denne migration, da intet er grantet til
`ai_service` her.

**Edge Function `provision-child-auth`** (deployeret, version 1, aktiv):
opretter selve `auth.users`-rækken + sætter `profiles.auth_user_id`.
Kræver en gyldig forælder/admin-JWT (valideret via `auth.getUser()`, IKKE
service-nøglen) og læser/verificerer ejerskab af profilen med KALDERENS
JWT under RLS (`profiles_owner_all`) — ingen egen ejerskabs-logik i
funktionen. Idempotent (allerede sat `auth_user_id` → no-op-svar).
Kapløbs-værn: `update ... where auth_user_id is null`, og rydder op i den
overflødige auth-bruger hvis en anden proces vandt kapløbet.
**Kræver en Secret der endnu IKKE er sat:** `CHILD_AUTH_SERVICE_ROLE_KEY`
(Supabase → Edge Functions → Secrets, samme værdi som Project Settings →
API → service_role) — nødvendig fordi funktionen selv skal kalde
Admin-API'et (`auth.admin.createUser`), og `SUPABASE_SERVICE_ROLE_KEY` ikke
pålideligt er til stede som auto-env (kendt fund fra `generate-audio`).
Funktionen prøver `SUPABASE_SERVICE_ROLE_KEY` først og falder tilbage til
den eksplicitte secret. **Ikke ende-til-ende-testet med en rigtig
forælder-session endnu** (kræver secreten sat + en ægte JWT — næste
sessions første skridt, sammen med B2).

**Ejer-beslutning (denne session):** eksisterende testprofiler (Ali,
Zainab) provisioneres IKKE automatisk nu. De forbliver uden
`auth_user_id` indtil de aktiveres — enten manuelt til test, eller først
når B2 (rigtigt pin-login) rører dem. Ingen dataminimerings- eller
sikkerhedsgevinst ved at provisionere før der er en session-udstedende
mekanisme til at bruge identiteten til noget.

**UDVIDELSESPUNKT for Leverance B3** (uændret fra `20260723_delete_own_account`,
nu ét skridt tættere): en trigger på `profiles` DELETE skal slette den
tilhørende barne-auth-bruger, så `delete_own_account()` og den eksisterende
ét-kliks-barnesletning ikke efterlader forældreløse børne-auth-brugere.
Findes stadig ikke — B1 opretter kun identiteten, B3 rydder den op igen.

**FÆLDE fra planens del 5.1 (endnu ikke løst, hører til B2):**
`lib/progressQueue.ts` er én IndexedDB-kø delt af hele enheden og stopper
ved første fejl. Skifter enheden fra barn A til barn B med uafsendte poster
i køen, vil A's poster blive afvist af `record_progress` under B's session
og blokere køen permanent for B. Løsning (kø pr. `profile_id`) er en B2-opgave
— IKKE bygget i B1, og ikke et problem endnu, da ingen barne-sessioner
findes før B2.


## Leverance B2 — child-signin rate limiting + lock-down af verify_child_pin (2026-07-23)

`20260723_child_signin_rate_limit_b2.sql` — bygget som backend-fundamentet
for Leverance B2 (plan-boernesession-og-dashboard.md del 4: barnets pin
udsteder nu en RIGTIG session, ikke kun en UI-port).

**Ny tabel `pin_attempts`** (`profile_id` PK/FK til `profiles`, `attempt_count`,
`last_attempt_at`) — dataminimering: intet om barnet ud over selve tælleren.
RLS aktiveret, bevidst INGEN policies (fail-closed for anon/authenticated),
kun rørt af funktionen nedenfor + service_role.

**`attempt_child_pin(profile_id, attempt)`** (SECURITY DEFINER, samme
mønster som `record_progress()`): gør rate-tjek + pin-verifikation +
forsøgs-registrering ATOMISK i ét kald. Stigende forsinkelse
(0/0/5/15/30/60 sek. efter hhv. 1.–6.+ fejl i træk), **aldrig lockout**.
Tidsforfald efter 30 minutter glemmer en gammel fejlserie.

**To reelle bugs fanget af regressionstesten selv, før migrationen blev
endelig** (dokumenteret her fordi rækkefølgen i funktionens krop nu ser
bevidst, ikke tilfældig, ud):
1. En ulåst profil (intet pin sat — standarden for alle børn i dag) kunne
   fejlagtigt blive rate-limitet af en efterladt `pin_attempts`-tilstand,
   selvom der ingen hemmelighed er at beskytte. Fix: `pin_hash` tjekkes
   FØR forsinkelsen håndhæves, ikke efter.
2. Et ukendt profil-id ville have kastet en rå FK-violation (fra
   `pin_attempts.profile_id`s FK til `profiles`) i stedet for et pænt
   svar. Fix: profilen slås op FØR noget som helst skrives til
   `pin_attempts` — findes den ikke, svares der `invalid` med det samme,
   uden at røre tabellen overhovedet.

**Bevist med rollback-markør-regressionstest mod live-DB (Ali som
testprofil, pin/attempts midlertidigt sat/rettet, 0 rækker persisteret):**
forsinkelsesstige 0/0/5/15/30/60 ✓ · aktiv rate limit blokerer selv et
korrekt pin ✓ · forsinkelse udløbet accepterer korrekt pin og rydder
rækken ✓ · tidsforfald efter 31 min. glemmer en gammel fejlserie ✓ · ulåst
profil ignorerer ALTID en efterladt attempts-række ✓ · ukendt profil-id
giver pænt `invalid`-svar uden FK-fejl og uden at oprette en række ✓ ·
`anon`/`authenticated` har hverken funktions- eller tabel-adgang ✓.

**KRITISK SIKKERHEDSFUND under implementeringen:** `verify_child_pin` (den
ældre, statsløse boolean-RPC fra `20260718124834_fase1b_profiler_pin_
samtykke.sql`) var granted EXECUTE til `anon`/`authenticated` og har INGEN
rate limiting. Var den forblevet frit tilgængelig, kunne den have brugt
som en ubegrænset gætte-oracle (op til 1320 kombinationer på sekunder)
UDEN OM `attempt_child_pin`'s rate limiter — hele arbejdet ovenfor ville
have været ren kosmetik. Samme migration reverserer derfor dens grants
(`revoke execute ... from anon, authenticated`). `child-signin` (Edge
Function) → `attempt_child_pin` er nu den ENESTE vej til at verificere en
pin. `set_child_pin` er UPÅVIRKET og forbliver som den er — den kræver
allerede en ægte forælder/admin-session, ikke en gættelig pin.

**Edge Function `child-signin`** (`supabase/functions/child-signin/`,
deployeret, version 2, aktiv, `verify_jwt: true`): kalder udelukkende
`attempt_child_pin` (ingen egen forsøgs-logik). Ved succes udsteder den et
engangs-magiclink-token (`auth.admin.generateLink`) som klienten selv
indløser med `supabase.auth.verifyOtp()` — service-nøglen og barnets
adgangskode forlader aldrig funktionen. Svarer `409 needs_provisioning`
hvis profilen mangler `auth_user_id` (forælderen skal først trykke
"Aktivér egen adgang", Leverance B1/session 15). Genbruger
service-nøgle-mønsteret fra `provision-child-auth`
(`SUPABASE_SERVICE_ROLE_KEY` først, `CHILD_AUTH_SERVICE_ROLE_KEY` som
fallback — allerede sat i Secrets).

**Frontend (samme session):**
- `features/pin-login/`: `verifyPin`/`verify_child_pin` erstattet af
  `attemptChildSignin` (`engine.ts`) mod `child-signin`. `usePinLogin.ts`
  omlagt fra "tjek ved hvert tastetryk" til DEBOUNCE (550ms pause, eller
  `MAX_PIN_LEN` nået) — et rigtigt rate limit gør "spørg serveren
  optimistisk ved hver længde" for dyrt (ville bruge budgettet op på ren
  "ikke færdig endnu"-støj). Nye statusser `rate_limited`/`not_provisioned`
  med nedtælling. Ulåst profil springer stadig pin-skærmen helt over
  (kendt fra `profile.pin_hash`, ikke fra en gættelig server-oracle).
- `features/app-shell/useAppShell.ts`: nyt `completeChildSignin` — eksplicit
  `signOut()` af forælderen FØR `verifyOtp()` som barnet (to identiteter,
  aldrig begge aktive). Ny `authTransitionInFlight`-guard forhindrer
  `onAuthStateChange` i at bounce'e til "landing" midt i det kontrollerede
  skifte. **Sikkerhedskritisk fix undervejs:** `gatePassed` (forældre-
  portens "allerede bekræftet denne session"-flag) nulstilles nu eksplicit
  når et barn logger ind — ellers kunne et barn gå picker → "🔒 Forælder"
  → parent_gate og springe lige ind i dashboardet uden kodeord, hvis en
  forælder tidligere havde bestået porten i samme browser-session.
  `goTo("picker")` genbruger nu den allerede hentede profilliste i stedet
  for at gen-hente under en (evt.) barne-session — en gen-hentning ville
  fejle under RLS (barnet ser kun sig selv) og tømme listen for søskende.
  Forældre-porten (`submitGate`) er ændret fra ren kodeord-genindtastning
  til FULD e-mail+adgangskode-reautentificering, fordi den aktive session
  ikke længere pålideligt er forælderens.
- `lib/progressQueue.ts` (fælde 5.1, plan-boernesession-og-dashboard.md del
  5.1): `flushQueue` grupperer nu poster pr. `profileId` og stopper kun den
  ramte profils resterende poster ved fejl — et profilskift (Ali → Zainab)
  blokerer ikke længere Zainabs poster, selvom Alis gamle poster afvises.
- `lib/childRoster.ts` (ny): enheds-lokal cache af `{profileId,
  displayName, avatar}` pr. barn, skrevet ved hvert vellykkede login.
  ALDRIG `pin_hash`. Fuldt taget i brug (bootstrap af picker uden
  forælder-session) er Leverance B4 — her bygges kun selve lageret +
  "Glem denne enhed"-knappen i forældre-portalen (`ParentAuth.tsx`).

**IKKE bygget i denne leverance (B4-scope, kendt og dokumenteret):** en
side-genindlæsning midt i en aktiv barne-session fører i dag tilbage til
pin-skærmen (viser kun barnet selv i "familien", da RLS kun viser egen
profil), IKKE direkte tilbage til spillet. Fuld sessionskontinuitet efter
genindlæsning kræver roster-drevet boot af hele skallen (B4).

Build-kæde grøn: `tsc --noEmit` 0 · `oxlint` 0/0 · **104/104 tests**
(93 tidligere + 9 nye `childRoster.test.ts` + 2 nye fælde-5.1-tests i
`progressQueue.test.ts`) · build ✓.


## Voksnes sprogvalg-UI — accounts.ui_language (2026-07-24)

`20260724_accounts_ui_language.sql`: tilføjer `accounts.ui_language`
(spejler `profiles.ui_language` 1:1 — samme default/constraint, inkl. 'en'
som endnu ikke har nogen `en.ts`-ordbog). Ren dataudvidelse, ingen ny RLS/
trigger — `accounts_update_own` dækkede allerede kolonnen, `trg_accounts_
protect_role` vogter kun role/id. Bevist med 3-punkts rollback-markør-test
(egen konto ✓ · ikke andres ✓ · ugyldig værdi afvist ✓).

Frontend samtidig: ny `LanguageProvider`/`useLanguage()` i `src/lib/i18n/`
kobler DA/AR-skifteren til hele forælder-/admin-træet under `ParentAuth.tsx`
(login/signup → samtykke → Dashboard/VokabVaerksted/HistorieVaerksted/
OpretProfil). Sprog huskes i localStorage FØR login (ejer-beslutning
2026-07-24: skifteren skal være synlig hele vejen, ikke kun efter login);
DB'ens `ui_language` vinder og synkroniseres ind ved login. `dirFor()`
(fandtes, men var ubrugt) er nu koblet på scenens container. Børnevendt UI
(spil, WorldMap, PinLogin, ChildMode) og `ErrorScreen` er UÆNDREDE — det
er D3's opgave (plan-boernesession-og-dashboard.md), ikke denne.


## D1 — Item-statistik: datalag + skrive-RPC (2026-07-24)

**Drift fundet ved sessionens skema-tjek:** `profile_item_stats` var
allerede anvendt direkte på live-DB (version `20260724130816`, navn
`profile_item_stats_d1`) — matchede plan-boernesession-og-dashboard.md
§6.2's spec til punkt og prikke (samme RLS-mønstre som `profiles`/
`progress`), men lå hverken i repoet eller i `docs/handoff.md`. 0 rækker,
ingen tilknyttet skrive-funktion. Mest sandsynlige forklaring: en tidligere
session fik migrationen anvendt men afsluttede aldrig commit/dokumentation.
`20260724130816_profile_item_stats_d1.sql` REKONSTRUERER den (idempotent,
no-op på live, fuld opbygning på et frisk miljø) for at lukke hullet.

`20260724173453_record_item_stat_rpc.sql`: `record_item_stat(profile_id,
item_type, item_id, correct)` — atomisk upsert (`insert ... on conflict do
update`), samme SECURITY DEFINER + tre-vejs ejerskabstjek som
`record_progress()` (forælder / admin / barnets egen session via
`auth_user_id`). `item_type` begrænset til `letter`/`vocabulary` af
tabellens CHECK-constraint, valideret pænt i funktionen først. Bevist med
rollback-markør-regressionstest mod live-DB (0 rækker persisteret): forælder
skriver for eget barn ✓ · akkumulering over to kald (seen_count/
correct_count) ✓ · fremmed forælder afvist ✓ · barnets egen session skriver
for sig selv ✓ · barnets session afvist for søskendes profil ✓ · ugyldig
item_type afvist ✓.

**Spil-koblingen (samme session, D1 nu FULDT GENNEMFØRT):** ny
`src/lib/itemStats.ts` — tynd fire-and-forget-wrapper om `record_item_stat`,
BEVIDST uden IndexedDB-kø (som `lib/progress.ts` har): en tabt tælling er
lavt-risiko ren statistik, ingen XP/streak/completion på spil, så endnu et
offline-lager ville være ude af proportion. `correct`-flaget er strengere
end spillets egen rigtig/forkert-følelse — det betyder "ramt uden at prøve
forkert først" (firstTry), ikke "endte rigtig", ellers ville soft-skindets
"kan ikke fejle"-design skjule præcis det mønster stats'en skal vise.

Koblet i tre hooks: `useListenFind.ts` (`answer()` — item_type udledes af
`current.kind`, item_id fra det korrekte valg), `TegnBogstavetGame.tsx`
(`handleComplete()` — item er altid `letter`, korrekt = `isCleanTrace`),
`useMatchPairs.ts` (`resolveMatch`/`resolveMiss` OG soft-skindets inline
miss-gren i `tapCard`, som ikke går gennem `resolveMiss` — begge ords id
tælles ved et miss, kun ét ved et match). Alle tre guardet af `profileId`
tilstede (gæster/uden profil skriver intet).

Build-kæde grøn: `tsc --noEmit` 0 · `oxlint` 0/0 · **117/117 tests**
(uændret — ingen ny branch-logik i `engine.ts`-filerne, kun kald ud til en
utestet IO-wrapper, samme princip som `updateAccountLanguage`) · build ✓.

D2 (dashboard-visning af tallene) er en efterfølgende leverance.

---

## D2 — Læringstal i forældre-dashboardet (2026-07-24)

**Ingen migration.** D2 er ren LÆSNING oven på D1's tabel og bruger de
policies der allerede findes — der er bevidst ikke tilføjet skema.

Læse-vejen er dog ny og derfor bevist selvstændigt mod live-DB
(rollback-markør, 0 rækker persisteret):

1. Forælder læser begge egne børns tællere ✓
2. Fremmed forælder ser 0 rækker ✓
3. Barnets egen session ser KUN sig selv — ikke søskendes ✓
4. `ai_service` ser 0 rækker ✓
5. Claim-løs session (tom JWT-payload) ser 0 rækker — fail-closed ✓

**Fund undervejs:** `profile_item_stats_child_select_own` binder barnet via
`profiles.auth_user_id = auth.uid()` — IKKE via et `profile_id`-claim i
JWT'en. Det er den stærkere konstruktion (et claim kunne i princippet
sættes af en fremtidig fejl i hooket; FK-koblingen kan ikke), og enhver
fremtidig test skal derfor bruge barnets rigtige `auth_user_id`, ikke et
syntetisk claim. En første version af regressionstesten fejlede netop dér.

**Fortolkningen ligger i kode, ikke i databasen:**
`features/dashboard/learning.ts` (ren, testet — `learning.test.ts`, 16
tests). Tærskler ejer-besluttet 2026-07-24: `MIN_SEEN = 3` gælder BEGGE
veje (uden den ville ét heldigt/uheldigt svar kunne rykke et bogstav ind
i "kan" eller ud i "øver stadig", og tallene ville hoppe uden grund),
`KNOWN_RATE = 0.70`, `STRUGGLING_RATE = 0.40`. Midterfeltet er bevidst en
neutral `learning`-kategori: barnet bliver hverken rost eller udpeget på
et tyndt grundlag.

**Ærlighed om hvad tællerne kan bære:** `profile_item_stats` er tællere,
ikke en hændelseslog — vi ved *at* ب driller, aldrig *hvad* barnet trykkede
i stedet. Derfor formuleres forklaringen som lighed ("ب ligner ت og ث"),
og kun når to bogstaver i samme rasm-gruppe rent faktisk BEGGE er svage
hos barnet, siges "driller begge". Det er en observation; alt andet ville
være et gæt præsenteret for forælderen som viden.

**Delt domæne-viden:** rasm-ligheds-grupperne er flyttet fra
`features/lyt-og-find/engine.ts` til `lib/letterSimilarity.ts` (uændret
indhold), så spillets distraktor-valg og dashboardets forklaringer ikke
kan drifte fra hinanden — siger spillet at ب og ت ligner hinanden, siger
dashboardet det samme.

Nævneren for ord tæller kun `is_published = true`: kladder fra værkstedet
kan barnet ikke møde i spillene, så de må ikke få "34 af 107" til at falde,
hver gang der oprettes en kladde.

Build-kæde grøn: `tsc --noEmit` 0 · `oxlint` 0/0 · **133/133 tests**
(117 → 133, +16 nye i `learning.test.ts`) · build ✓.
