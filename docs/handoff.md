# handoff.md — Nour: Start her

*Copy-paste-venlig opstart til enhver ny session. Læs sammen med instruktion.md og SKILL.md.*

---

## Hvad er Nour?

Jeg bygger **Nour (نور)** — en gratis, dansk-dominant tosproget læringsplatform for børn (3–14 år), der lærer **arabisk sprog** og **shia-islamisk viden**. Målgruppe: børn i dansk-arabiske shia-familier. Dansk bærer instruktionen; arabisk læres. Gratis for børn for altid. Kvalitet før tempo.

## Vigtigste princip (læs altid)

To slags indhold, aldrig blandet:
- **Aqidah** (12 imamer, tawhid, teologiske fakta) = ALDRIG AI. Kun menneske-godkendt fra shia-kilder. Låst bag godkender-rolle + teknisk mur (DB/pipeline/UI).
- **AI-tilladt** (akhlaq, manerer, sprog, spil) = AI må skrive.

De hellige (Profeten ﷺ + 12 imamer) afbildes ALDRIG som skikkelse — kun som lys. Figurer er nutidige børn der bærer navnene (Ali, Zainab osv.), ikke imamerne selv.

## Univers

"Nour-landet" med tre regioner: **Bogstavernes Dal** (sprog), **Historiernes Bjerge** (ahlulbayt/aqidah), **Hverdagshaven** (akhlaq). Lys vokser med barnets fremskridt. Én verden, tre aldersskind (3–6 / 7–10 / 11–14). Fire kernespil: Lyt & Find, Tegn Bogstavet, Match-par, Vælg din vej.

## Stack

React + Vite + Tailwind + shadcn/ui (fuld RTL/LTR) · Supabase (Postgres/Auth/Storage/RLS, EU) · PWA offline · Claude API kun til AI-tilladt indhold.

## Repository

**GitHub:** https://github.com/HBM-313/Al-Nour.git
**Token:** ligger IKKE i denne fil eller nogen anden fil i repoet. Indsættes i chatten kun når en session skal pushe — bruges udelukkende inline i push-kommandoen, aldrig gemt.
**Live app:** https://al-nour.hassu4264.workers.dev (Cloudflare Workers, auto-deploy fra `main`, ca. 1 min. efter push).
**CI:** `.github/workflows/ci.yml` kører `npm ci → tsc --noEmit → oxlint src → npm test → npm run build` på hver push/PR mod `main` (arbejdskatalog `app/`). Blokerer endnu ikke merge/push (ingen branch protection — ejerens eget valg).

## Roller

Admin (mig) · Indholds-redaktør (kan ikke udgive aqidah) · Godkender (eneste der kan sætte aqidah live).

---

## Hvor jeg er nu (opdater dette felt løbende)

**Status (2026-07-23, session 16 — Leverance B2: barnets pin udsteder nu en RIGTIG session. FULDT GENNEMFØRT og pushet.)**

B1 (session 14–15) byggede identiteten (`profiles.auth_user_id`, `child`-rolle via access-token-hooket, RLS) og lukkede den ende-til-ende (session 15: "Aktivér egen adgang"-knappen i dashboardet, Ali/Zainab begge aktiverede). Denne session tog identiteten i BRUG: dyre-pinnen er ikke længere kun en UI-port — en bestået pin (eller en ulåst profil) udsteder nu barnets EGEN, rigtige Supabase-session.

**Database (migration `20260723_child_signin_rate_limit_b2.sql`, live):** ny tabel `pin_attempts` + atomisk `attempt_child_pin()` (SECURITY DEFINER, samme mønster som `record_progress()`) — rate-tjek + pin-verifikation + forsøgs-registrering i ét kald. Stigende forsinkelse (0/0/5/15/30/60 sek. efter 1.–6.+ fejl), ALDRIG lockout. To reelle bugs fanget af regressionstesten selv og rettet FØR migrationen blev endelig: (1) en ulåst profil kunne fejlagtigt rate-limitedes af en efterladt tilstand — fix: `pin_hash` tjekkes FØR forsinkelsen håndhæves; (2) et ukendt profil-id ville have kastet en rå FK-fejl — fix: profilen slås op FØR noget skrives til `pin_attempts`. Bevist med rollback-markør-regressionstest mod live-DB (Ali som testprofil), 0 rækker persisteret.

**KRITISK SIKKERHEDSFUND undervejs:** den ældre `verify_child_pin`-RPC (statsløs boolean, ingen rate limiting) var granted EXECUTE til `anon`/`authenticated` — havde den forblivet åben, kunne den bruges som en ubegrænset gætte-oracle (1320 kombinationer på sekunder) UDEN OM det nye rate limit. Låst ned (`revoke execute ... from anon, authenticated`) i samme migration. `child-signin` er nu den ENESTE vej til at verificere en pin. `set_child_pin` upåvirket (kræver allerede ægte forælder-session).

**Edge Function `child-signin`** (`supabase/functions/child-signin/`, deployeret v2, `verify_jwt: true`): kalder kun `attempt_child_pin`; udsteder ved succes et engangs-magiclink-token (`auth.admin.generateLink`), som klienten indløser med `verifyOtp()` — service-nøgle og adgangskode forlader aldrig funktionen. Svarer `409 needs_provisioning` mangler `auth_user_id`.

**Frontend:**
- `features/pin-login/`: pin-tjek flyttet fra den nu-låste `verify_child_pin` til `attemptChildSignin` (`child-signin`). `usePinLogin.ts` omlagt fra "tjek ved hvert tryk" til DEBOUNCE (550ms pause, eller `MAX_PIN_LEN`) — et rigtigt rate limit gør den gamle optimistiske per-tryk-polling for dyr. Nye statusser `rate_limited` (med nedtælling)/`not_provisioned`.
- `features/app-shell/useAppShell.ts`: nyt `completeChildSignin` — eksplicit `signOut()` af forælderen FØR `verifyOtp()` som barnet (to identiteter, aldrig begge aktive), bag en `authTransitionInFlight`-guard så `onAuthStateChange` ikke bounce'r til "landing" midt i skiftet. **Sikkerhedskritisk fix undervejs:** `gatePassed` nulstilles nu eksplicit ved et barne-login — ellers kunne et barn gå picker → "🔒 Forælder" → parent_gate og springe lige ind i dashboardet uden kodeord, hvis en forælder tidligere havde bestået porten i samme browser-session. `goTo("picker")` genbruger nu den allerede hentede profilliste (i stedet for at gen-hente under en barne-session, som ville fejle under RLS og tømme listen for søskende) — løser sidedeleflowet for søskende uden en voksen. Forældre-porten er ændret fra kodeord-genindtastning til FULD e-mail+adgangskode-reautentificering (den aktive session er ikke længere pålideligt forælderens).
- `lib/progressQueue.ts` (fælde 5.1 LUKKET): `flushQueue` grupperer nu poster pr. `profileId` — et profilskift (Ali → Zainab) blokerer ikke længere Zainabs poster, selvom Alis gamle poster afvises.
- `lib/childRoster.ts` (ny): enheds-lokal cache af `{profileId, displayName, avatar}` pr. barn — ALDRIG `pin_hash`. Skrevet ved hvert login; "Glem denne enhed"-knap i `ParentAuth.tsx`s Welcome-visning rydder den. Fuldt taget i brug (bootstrap af picker uden forælder-session) er Leverance B4.

**IKKE bygget (B4-scope, kendt og dokumenteret):** en side-genindlæsning midt i en barne-session fører i dag tilbage til pin-skærmen (RLS viser kun barnet selv i "familien"), ikke direkte tilbage til spillet. Fuld sessionskontinuitet efter genindlæsning kræver roster-drevet boot af skallen (B4).

Build-kæde grøn: `tsc --noEmit` 0 · `oxlint` 0/0 · **104/104 tests** (93 tidligere + 9 nye `childRoster.test.ts` + 2 nye fælde-5.1-tests) · build ✓.

**Næste skridt:** Leverance B3 (sletning/livscyklus ende-til-ende — trigger på `profiles` DELETE skal slette den tilhørende barne-auth-bruger, `delete_own_account()` udvides) og B4 (skallen bygget om til to rigtige indgange, roster-drevet boot). Se `plan-boernesession-og-dashboard.md` → Leverance B3/B4.

---

**Status (2026-07-23, session 15 — B1's åbne ende LUKKET: "Aktivér egen adgang"-knap bygget, pushet og bevist ende-til-ende. Commit `0e003ec`.)**

B1 (session 14) efterlod én åben ende: Edge Function `provision-child-auth` var deployeret men ALDRIG ende-til-ende-testet, fordi Claudes container ikke kan nå Supabase's projekt-URL direkte. Denne session lukkede den ende ved at bygge selve klik-vejen i appen og lade ejerens tryk i telefon-browseren være den reelle test.

**Bygget (frontend, ingen migration — bruger eksisterende `profiles.auth_user_id` fra B1):** `features/dashboard/engine.ts` fik `provisionChildAuth(profileId)` (kalder `supabase.functions.invoke("provision-child-auth")`, idempotent) · `useDashboard.ts` fik `activateAccess(child)` + `provisioningId`-state · `Dashboard.tsx`: hvert barnekort viser nu badge "👤 egen adgang" ELLER en "Aktivér egen adgang →"-knap.

**Bevist ende-til-ende mod live-DB** (efter ejerens klik i telefonen): Ali (`b1bc21cd-…`) → `auth_user_id` `2ea57415-…`, e-mail `c-b1bc21cd-…@child.nour.invalid`. Zainab (`94f698f3-…`) → tilsvarende. Begge har nu en rigtig `auth.users`-række.

**Ejer-beslutninger (til B2, indarbejdet i session 16 ovenfor):** dyre-pin forbliver VALGFRI for alle børn · 12 dyr i pin-grid'et (`ANIMAL_POOL` har allerede 12).

Build grøn ved push: `tsc --noEmit` 0 · `oxlint` 0/0 · **93/93 tests** (uændrede) · build ✓.

---

**Status (2026-07-23, session 14 — Leverance B1: barnets identitet i databasen. Database-lag + hook FULDT GENNEMFØRT og anvendt på live-DB; Edge Function deployeret men IKKE ende-til-ende-testet endnu; PUSH TIL REPO AFVENTER GitHub-token i chatten.)**

Problemet (plan-boernesession-og-dashboard.md, del 1–3): barnet spillede indtil nu INDE I forælderens session — dyre-pinnen var kun en UI-port, ikke en identitet. Alt et barn foretog sig skete med forælderens fulde rettigheder. Løst med **mulighed A**: hver børneprofil kan nu få sin egen `auth.users`-række med syntetisk e-mail (`c-<profil-uuid>@child.nour.invalid`, RFC 2606-reserveret, ruter ingen steder) og en kryptografisk tilfældig adgangskode intet menneske ser.

**Skema-drift-tjek FØR migrationen:** intet ændret siden `2ed0d1a` (Leverance 1.4). `auth_user_role()` bevist fail-closed for en bruger uden `accounts`-række (giver `'anon'`, ikke `null`/fejl). `content`/`letters`/`vocabulary`/`lessons`s offentlige læse-policies er rolle-uafhængige — et barn arver automatisk samme offentlige læseadgang, ingen ændringer nødvendige der.

**Migration `20260723_child_identity_b1` (anvendt på live-DB):** `profiles.auth_user_id uuid unique references auth.users(id) on delete set null` · `custom_access_token_hook` udvidet med en `child`-gren (ingen `accounts`-række + match i `profiles.auth_user_id` → claims `user_role:'child'` + `profile_id`) · ny trigger `trg_profiles_protect_child_columns` (samme mønster som `protect_account_role_and_id`) hvidlister PRÆCIS hvilke felter barnets session selv må ændre (`preferred_voice`, `transliteration_enabled`, `ui_language`) · additive RLS-policies `profiles_child_select_own`/`profiles_child_update_own`/`progress_child_select_own`, alle bundet til `auth_user_id = auth.uid()` (den faktiske signerede bruger, ALDRIG et klient-styret claim) · `record_progress()`s ejerskabstjek (ét sted i funktionen) udvidet med en tredje vej for barnets egen session. Se `supabase/migrations/README.md` → "20260723_child_identity_b1" for det fulde design.

**Bevist med rollback-markør-regressionstest mod live-DB, 0 rækker persisteret** — alle 8 punkter fra planens B1-afsnit: barn ser egen profil ✓ · ikke søskendes ✓ · ingen adgang til `accounts` ✓ · kan ikke ændre `pin_hash`/flytte `owner_account_id` (trigger blokerer) ✓ · KAN ændre hvidlistede felter ✓ · kan gemme eget fremskridt via `record_progress` ✓ · ikke søskendes fremskridt ✓ · forælderens session upåvirket (ingen regression) ✓. `ai_service`s nul tabel-adgang til `profiles`/`accounts`/`progress` bekræftet uændret (`has_table_privilege` — ingen grants overhovedet, uafhængigt af RLS). Ali/Zainab er URØRTE — ejer-beslutning denne session: ingen automatisk provisionering af eksisterende profiler, kun ny/eksplicit aktivering fremover.

**Edge Function `provision-child-auth`** (deployeret, version 1, aktiv, `verify_jwt: true`): opretter selve auth-identiteten. Kræver gyldig forælder/admin-JWT (IKKE service-nøglen), læser/verificerer ejerskab med KALDERENS JWT under eksisterende RLS (`profiles_owner_all`) — ingen egen ejerskabs-logik. Idempotent + kapløbs-værn (rydder op i en tabt væddeløbers overflødige auth-bruger). **Mangler en Secret for at kunne bruges:** `CHILD_AUTH_SERVICE_ROLE_KEY` (Supabase → Edge Functions → Secrets, samme værdi som Project Settings → API → service_role) — ejer-handling, kan ikke sættes via MCP/SQL. Funktionen er derfor IKKE ende-til-ende-testet med en rigtig session endnu.

Build-kæde grøn: `tsc --noEmit` 0 fejl · `oxlint` 0/0 · **93/93 tests** (uændrede — B1 er databaselag, ingen ny frontend-logik ud over et nyt felt i `types.ts`) · build ✓.

**FÆLDE fra planens del 5.1, endnu IKKE løst (hører til B2, ikke bygget her):** `lib/progressQueue.ts` er én IndexedDB-kø delt af hele enheden og stopper ved første fejl. Med rigtige barne-sessioner vil et profilskift med uafsendte poster i køen blokere permanent for den nye profil. Løsning (kø pr. `profile_id`) er B2's opgave.

**Næste skridt:** **Leverance B2 — pin-login der udsteder en rigtig session.** Forudsætning: ejeren sætter `CHILD_AUTH_SERVICE_ROLE_KEY` og vi ende-til-ende-tester `provision-child-auth` først. Derefter: Edge Function `child-signin` (dyre-sekvens → bcrypt-verifikation → session via Admin-API), rate limiting (`pin_attempts`, stigende forsinkelse, ALDRIG lockout af barnet), enheds-lokal familie-roster i localStorage (kun `{profile_id, display_name, avatar}`, ALDRIG `pin_hash`), og fælde 5.1's kø-pr.-profil-fix. Se `plan-boernesession-og-dashboard.md` → Leverance B2.

---

**Tidligere status (2026-07-23, session 13 — Leverance 1.4: GDPR, forælderen kan slette sin egen konto, FULDT GENNEMFØRT.)**

Barnets data kunne slettes med ét klik (Leverance D); forælderens egen konto kunne ikke — ingen DELETE-policy på `accounts`. Art. 17 gælder også den voksne.

**Slette-graf kortlagt før migrationen** (fuld `pg_constraint`-scan): `auth.users` → `accounts` → `profiles` → `progress`/`progress_events`/`class_members` (alt CASCADE), samt `accounts` → `classes` (CASCADE, hvis lærer) → `class_members`. FUND: fire kolonner pegede på `accounts` med `ON DELETE NO ACTION` — `content.created_by`, `content.published_by`, `content_reports.reporter_account_id`, `media.created_by` — ville have blokeret sletning for en redaktør/godkender-konto der har oprettet/publiceret indhold eller rapporteret en fejl. Rettet til `SET NULL` (alle fire nullable, ingen CHECK afhænger af dem, muren urørt). `error_log` har bevidst ingen FK til accounts/profiles (dataminimering) og indgår ikke i grafen. Se `supabase/migrations/README.md` → "delete_own_account()" for det fulde design.

**RPC:** `delete_own_account()` (SECURITY DEFINER, ejet af `postgres`, ingen parametre — sletter altid kun `auth.uid()`s egen konto via `delete from auth.users`, resten kaskaderer). Grant kun til `authenticated`. Bevist med rollback-markør-regressionstest mod live-DB (0 rækker persisteret, to engangs-testkonti brugt — ikke test-foraelder@nour.test): uautentificeret afvist ✓, kryds-konto-isolation (konto B sletter sig selv, konto A upåvirket) ✓, fuld sletning efterlader 0 forældreløse rækker i `accounts`/`profiles`/`progress`/`progress_events`/`class_members`/`classes` ✓, Ali (reel testdata) urørt ✓.

**Udvidelsespunkt for Leverance B3** (plan-boernesession-og-dashboard.md) markeret eksplicit i funktionens krop: når børn får egne `auth.users`-rækker, skal en trigger på `profiles` DELETE slette den tilhørende barne-auth-bruger.

**Ejer-beslutninger:** øjeblikkelig sletning (ikke soft-delete — stærkest GDPR-position) · adgangskode-genindtastning kræves før sletning.

**Frontend** (`features/parent-auth/`): `engine.ts` fik `verifyOwnPassword` (samme `signInWithPassword`-mønster som `app-shell`s forældre-gate) og `deleteOwnAccount` (kalder RPC'en, rydder derefter klient-sessionen med `supabase.auth.signOut()`). `useParentAuth.ts` fik `deleteAccount(password)` + `justDeleted`-tilstand. `ParentAuth.tsx`: `Welcome`-visningen har en diskret "Slet min konto"-link under "Log ud" (synlig for alle kontoroller — RPC'en skelner ikke), åbner et to-trins overlay (forklaring → adgangskode → uigenkaldelig sletning), og en rolig `Farewell`-skærm vises efter succes i stedet for straks at falde tilbage til login-formularen. Ny CSS-klasse `.auth-danger-link`.

Build-kæde grøn: `tsc --noEmit` 0 fejl · `oxlint` 0/0 · **93/93 tests** (uændrede — ingen eksisterende test rørte konto-sletning) · build ✓.

**Næste skridt:** B-blokken fra `plan-boernesession-og-dashboard.md`, startende med **B1 — barnets identitet i databasen** (egen Supabase-auth-bruger pr. barn med syntetisk e-mail, `child`-rolle via access-token-hooket ud fra `profiles.auth_user_id`, RLS så barnet kun ser sig selv, `record_progress` udvidet til at acceptere barnets egen session). Den tungeste og mest sikkerhedskritiske leverance siden Fase 0's mur — læs hele del 4 og del 5 i planen først, særligt fælde 5.1 (skrivekøen går i baglås ved profilskift, hvis den ikke gøres pr. profil).

---

**Tidligere status (2026-07-22, session 12 — Leverance 1.3: global streak, FULDT GENNEMFØRT.)**

Streak lå hidtil på `progress` med `UNIQUE(profile_id, lesson_id)` — altså én streak PR LEKTION, ikke pr. barn. Et barn der spillede trofast hver dag, men skiftede lektion, oplevede at streaken evigt viste "1". Rettet: nye kolonner `profiles.streak_count` + `profiles.last_active_day` (dato, ikke tidsstempel), `record_progress()` omskrevet til at låse profil-rækken (`for update`) og beregne streaken globalt pr. barn i stedet for pr. (profil, lektion). Se `supabase/migrations/README.md` → "Global streak" for det fulde design, herunder den bevidste beslutning om at FRYSE `progress.streak_count` (bevaret som historik, ikke længere skrevet til). Bevist med 8-punkts rollback-markør-regressionstest mod live-DB (0 rækker persisteret): samme dag/ny lektion fordobler ikke streaken, "i går" → +1, hul ≥2 dage → nulstil, søskendes streaks er uafhængige, uautoriseret bruger afvises. Frontend porteret: `features/dashboard/engine.ts` (den tidligere `Math.max`-udledte "bedste streak" på tværs af lektioner er erstattet af et direkte read af `profile.streak_count`; feltet omdøbt `bestStreak` → `streakCount` i `ProgressSummary`, `Dashboard.tsx` fulgt med), `features/app-shell/engine.ts` (`migrateGuestProgress` skriver ikke længere til den nu frosne `progress.streak_count`), `lib/types.ts` (nye felter på `Profile`, `Progress.streak_count` markeret frosset i JSDoc). Build-kæde grøn: `tsc --noEmit` 0 fejl · `oxlint` 0/0 · **93/93 tests** (uændrede — ingen af de eksisterende tests rørte streak-logik) · build ✓.

**Dokumentations-oprydning (denne session):** forrige sessions note om at have "bragt `docs/handoff.md` ajour" var ikke korrekt — denne fil manglede stadig live-app-URL, CI-beskrivelse og havde en selvmodsigende "ikke reconcileret siden 2026-07-17"-flag stående i commit `846e9cc`. Rettet nu (Repository-sektionen ovenfor + denne sektion). Hold øje med at dette IKKE sker igen: opdatér altid `docs/handoff.md` i selve repoet ved hver milepæl, ikke kun Project-filen.

**Tidligere status (2026-07-22, session 11 — Leverance 1.1 + 1.2: offline-kø + atomisk `record_progress`-RPC, FULDT GENNEMFØRT inkl. UI.)** Se `supabase/migrations/README.md` → "record_progress-RPC + event-idempotens" for den fulde tekniske beskrivelse. Kort resumé:

- **1.2 — atomisk RPC:** `progress.ts`s tidligere læs-derefter-skriv er erstattet af én atomisk Postgres-funktion `record_progress()` (`INSERT ... ON CONFLICT DO UPDATE`). Xp forbliver additiv (delta pr. runde, som hidtil). Idempotens sikres af en ny tabel `progress_events` (fail-closed RLS, ingen policies — kun RPC'en rører den): hvert kald bærer et `event_id`, og en gentagelse af samme id er et bevidst no-op. Ejerskabs-tjek som `set_child_pin`. Bevist med 11-punkts rollback-markør-regressionstest mod live-DB, 0 rækker persisteret.
- **1.1 — offline-kø:** nyt modul `lib/progressQueue.ts` — IndexedDB-baseret FIFO-skrivekø (ikke localStorage). `saveStepProgress`/`saveRoundProgress` skriver ALTID til køen først og forsøger straks afsendelse; lykkes det ikke (offline), bliver posten trygt liggende og forsøges igen. `startSyncEngine()` tømmer køen ved app-start og på hvert `online`-event — wired ind i `useAppShell.ts`. 9 nye tests (`progressQueue.test.ts`, `fake-indexeddb`).
- **1.1 (UI) — rolig gemmes-status:** ny `"queued"`-tilstand for alle fire spil, vist som en blødt pulserende guld-prik + "Dit lys gemmes, når du er online igen".
- Pushet i tre commits: `3f1516b` (1.2-RPC), `c137fe9` (1.1-kø), `7cf0073` (1.1 UI-status).

**Næste skridt:** Leverance 1.4 — GDPR: forælderen kan slette sin egen konto (mangler en DELETE-policy på `accounts`; Art. 17 gælder også den voksne, ikke kun barnet). Se `plan-platformsmodning.md` §1.4.

---

**Ældre status (før 2026-07-17, historisk — se ovenstående flag):** Fase 0 deployeret og verificeret. Supabase-projekt "Al-Nour" kører i eu-central-1 (EU ✓). Skema + RLS + aqidah-mur-trigger er live. Muren er hærdet efter fund af tre fail-open-huller (NULL-semantik, SECURITY DEFINER-identitet, claim-løse sessioner) — alle lukket og bevist med testserie: editor/service_role afvises, kun approver/admin (eller ejer via dashboard) kan udgive aqidah, kilde-verifikation påtvinges. ai_service kan kun indsætte ai_allowed-kladder, ikke opdatere, og kan ikke læse aqidah. Frontend-fundament bygget: Vite+React+Tailwind v4, PWA offline, RTL/LTR-komponenter (dir pr. blok), tre aldersskind, AI-pipeline-mur hardcodet.

**Fase 1-datalag (2026-07-14):** `letters` (28 bogstaver, hija'i-orden, fire former som GENEREREDE kolonner via tatweel — kan ikke drifte) og `vocabulary` (54 ord i 9 kategorier, koblet til startbogstav via `first_letter_id`, `register` fusha/everyday) er live og seedet. LYD-REGLEN er nu teknisk håndhævet: `trg_letters_audio_human` afviser AI-lyd og ukendte medier på bogstaver (fail-closed, testet). RLS: offentlig læsning, kun admin/editor skriver, ai_service har nul adgang. Drift-fix: `set_updated_at()` manglede helt i live — oprettet + triggere på 6 tabeller. TypeScript-typer (`Letter`, `VocabularyWord`) tilføjet i types.ts, typecheck OK.

**Lyt & Find (2026-07-14):** Første kernespil bygget i `app/src/features/lyt-og-find/` (engine.ts ren logik + useListenFind.ts hentning/tilstand/progress-gem + audio.ts + ListenFindGame.tsx). Tre aldersskind: soft = 2 kæmpevalg, ingen forkert-følelse; mid = 4 valg (bogstaver+ord), XP + dags-streak upsert i progress; teen = bogstav-former med samme-rasm-distraktorer (ب blandt ت ث ن). Distraktor-sværhedsgrad styres af visuelle ligheds-grupper. Lesson-række 'Lyt & Find' seedet i live (id eda50413-2e28-4de4-b331-80951d908e92). Spillet er lyd-drevet fra dag ét: medie-fil (human/AI) vinder, ellers browser-TTS-pladsholder, ellers tekst-fallback. Typecheck, oxlint og fuld PWA-build grønne.

**LYD-REGLEN ÆNDRET (ejer-beslutning 2026-07-14) — vigtigt for alle fremtidige sessioner:** AL lyd i projektet må være TTS/AI-genereret (fx ElevenLabs, Google) eller uploadet fil, og kan frit udskiftes. DEN ENESTE UNDTAGELSE: Quran-recitation skal være menneskelig (media_ai_never_recitation består urørt). Migration `20260714_fase1_lydregel_lempet.sql` er deployeret og testet: trg_letters_audio_human er ERSTATTET af trg_letters_audio_valid (AI-lyd accepteres nu ✓, recitation-markeret lyd på bogstaver afvises ✓, ukendt medie afvises fail-closed ✓). Spillet har fået TTS-pladsholder-kæde: medie-fil → browser-TTS → tekst-fallback. Dette er en BEVIDST lempelse — skal IKKE "rettes" tilbage. NB: SKILL.md/instruktion.md i Claude-projektmappen skal opdateres tilsvarende (gammel human-only-formulering står der stadig).

**Lyd-status (ejer-beslutning 2026-07-14):** Vi kører på browser-TTS forløbigt. AI-lyd (ElevenLabs/Google) og menneskelige optagelser tages i fremtiden — planlæg IKKE lyd-generering endnu. Arkitekturen er klar til skiftet: medie-fil vinder automatisk over TTS når den kobles på.

**Tegn Bogstavet (2026-07-14):** Andet kernespil bygget i `app/src/features/tegn-bogstavet/` — professionelt niveau med animationer og 3D-figur. Signatur: barnet MALER LYS ind i bogstavet (platformens kernemetafor som spilmekanik) — bogstavet starter som mørk silhuet, fingeren fylder det med gyldent nour-lys + gnist-partikler, og det "tænder" i lysudbrud ved fuld dækning. Teknik: pixel-dæknings-tracing (tracing.ts: glyf rasteriseres fra fonten, spatial buckets, TraceProgress-klasse) — virker for alle 28 bogstaver × 4 former uden håndtegnede streg-data; streger klippes til glyffen (source-atop) så lyset kun bor i bogstavet; RTL-start-hint (pulserende prik i højre side). 3D-følgesvend: Nouri, en lysånd i Three.js (NourCompanion.tsx, lazy-loadet chunk så hoved-bundlen er uberørt; CSS-glød-fallback uden WebGL; prefers-reduced-motion respekteret) med tilstande idle → cheer (milepæle 25/50/75 %, pulse-retrigger) → celebrate (spin + gnist-udbrud). BEVIDST valg: Nouri er en lysånd, IKKE et 3D-barn (primitiv-menneskefigurer bliver uhyggelige, og lysånden kan aldrig forveksles med afbildning af de hellige). Aldersskind: soft = 4 bogstaver, tyk pensel, tærskel 0.6, kan ikke fejle · mid = 5 bogstaver, XP for "rene" streger (10/5), tærskel 0.75 · teen = ét forbinder-bogstav i alle FIRE former, præcisionsmåler, tærskel 0.82. Lyd: fil → TTS-kæde (sayLetter). Delt kode udtrukket: `lib/audio.ts` (flyttet fra lyt-og-find) og `lib/progress.ts` (saveRoundProgress — dags-streak + XP-upsert, begge spil bruger den). Lesson-række 'Tegn Bogstavet' seedet (order_index 2). three + @types/three tilføjet. Typecheck/oxlint/PWA-build grønne.

**Bugfix efter live-test i Visualizer-demo (2026-07-14):** Ejer testede tracing-mekanikken via en isoleret HTML-demo (Claudes Visualizer-værktøj, ikke det rigtige spil) og fandt to ægte bugs, som VISTE SIG AT VÆRE TIL STEDE I DEN RIGTIGE SPILKODE OGSÅ — rettet i TraceCanvas.tsx:
1. **Klip-til-glyf virkede ikke:** `source-atop`-kompositionen blev tegnet direkte på hoved-canvas'et EFTER baggrunden allerede var fyldt, så "klip til bogstavet" i praksis klippede mod hele det uigennemsigtige lærred — barnets streger endte synlige uden for bogstavet, og én tyk streg kunne nå dæknings-tærsklen uden at følge formen. Fix: glyf-silhuet + klippet lys + burst tegnes nu på et separat gennemsigtigt offscreen `layer`-canvas (nulstillet pr. glyf-skift ligesom `paint`), som FØRST DEREFTER lægges oven på baggrunden med drawImage. Verificeret i demoen før porting til spilkoden.
2. **Pensel for tyk / tærskel for løs:** i SKIN_TUNING skærpet — soft brush 26→16 / threshold 0.6→0.62, mid 18→11 / 0.75→0.72 / maxOffRatio 0.5→0.35, teen 14→8 / 0.82→0.8 / maxOffRatio 0.35→0.22. Uden klip-fixet kunne én streg hen over midten af 'Ba' nå ~60% dækning; med begge fixes kræver fuldføring nu en reel bevægelse langs bogstavets form.
Bekræftet IKKE en bug (allerede korrekt i koden): completion styres udelukkende af `coverage >= threshold` i TraceCanvas — `isCleanTrace` bruges kun til rosen-teksten/XP-bonus, aldrig som betingelse for at komme videre.
Metode-note: Demoen i Visualizer var en isoleret HTML/JS-kopi (ikke importeret fra repoet) brugt til hurtig mobilvenlig test uden lokal opsætning — når ejer ikke kan bruge terminal/localhost. Nyttigt mønster til fremtidig UI-iteration før porting til rigtig kode.

**Næste skridt (2026-07-17):** Se nedenstående "TTS-status" — lyd er nu genereret og verificeret. Næste milepæl: profiler/auth (billede-pinkode til børn, forældresamtykke-flow).

---

## TTS-status (opdateret 2026-07-17)

**Leverandørskift: ElevenLabs → Google Cloud Text-to-Speech.** ElevenLabs' to udvalgte arabiske stemmer (Habibah ♀ / Ahmed ♂, samt en tredje fundet undervejs, Ashraf) viste sig alle at være Voice Library-stemmer, som ElevenLabs' egen dokumentation bekræfter ikke kan bruges via API på gratis plan (`402 paid_plan_required`) — bekræftet ved flere uafhængige testkørsler, inkl. efter at stemmerne blev tilføjet til workspacet. Fremfor at opgradere til en betalt ElevenLabs-plan blev Google Cloud Text-to-Speech valgt: permanent gratis niveau (1M tegn/md for Chirp3-HD-stemmer, langt over projektets behov på nogle få tusind tegn), Modern Standard Arabic understøttet (`ar-XA`).

**Stemmer (verificeret via `voices:list`-endpointet at gender stemmer):**
- Kvinde: `ar-XA-Chirp3-HD-Aoede`
- Mand: `ar-XA-Chirp3-HD-Charon`

**`generate-audio`-Edge Function omskrevet** (samme fil/struktur, kun TTS-kaldet og hemmeligheds-navnene ændret — se udførlig kommentar øverst i `supabase/functions/generate-audio/index.ts`). Datamodellen (`audio_media_id` / `audio_media_id_male`, `media`-tabellen, lyd-reglens `generated_by='ai'`/`is_recitation=false`) er **uændret** — den var allerede korrekt designet til et to-spors setup.

**Hemmeligheder (Supabase → Edge Functions → Secrets):**
- `GOOGLE_TTS_API_KEY` — Google Cloud API-nøgle, begrænset til Cloud Text-to-Speech API (mindste privilegie-princip fulgt, ligesom ElevenLabs-nøglen)
- `GOOGLE_TTS_VOICE_FEMALE` / `GOOGLE_TTS_VOICE_MALE` — valgfrie overstyringer, standardværdier er Aoede/Charon

**Alle 164 klip genereret og verificeret** (28 bogstaver + 54 ord × 2 stemmer). Ejeren har bekræftet fil-lyd afspiller korrekt i appen og stemmeskift (kvinde/mand) virker som forventet ved spilstart.

**Efterladt, ikke oprydet:** en midlertidig test-funktion `check-google-voices` (kaldte kun `voices:list`, ingen skrivninger, kræver stadig service-nøgle) ligger stadig i Supabase — kan slettes manuelt via dashboardet, ligger ikke i git.

**ElevenLabs-sporet er ikke fjernet fra databasen** — `TTS_API_KEY`-secreten og eventuelle tidligere ElevenLabs-genererede filer/media-rækker (hvis nogen nåede at blive oprettet før skiftet) er ikke ryddet op. Bør gennemgås hvis ElevenLabs helt skal udfases fra projektet.

**Åbne beslutninger / noter:**
- ~~SKEMA-DRIFT~~ LUKKET 2026-07-13: live `content` udvidet mod 0001-designet via `20260713_content_udvid_mod_0001.sql` (title_da/ar, sacred_representation, tre aldersvarianter, aqidah-constraints, indexes). Verificeret med testserie inkl. mur-regression. Bevidste blivende afvigelser dokumenteret i supabase/migrations/README.md.
- Valg af lyd-leverandør og illustrationsstil udestår.


---

## Sådan bruger jeg denne fil

1. Start ny session med instruktion.md + SKILL.md + denne handoff.md i projektmappen.
2. Opdater "Hvor jeg er nu" efter hver større milepæl, så næste session starter varmt.
3. Bed om ét konkret næste skridt ad gangen.
