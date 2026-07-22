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
