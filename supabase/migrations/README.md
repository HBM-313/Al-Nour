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
