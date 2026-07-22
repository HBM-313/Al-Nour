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

**Status (2026-07-23, session 13 — Leverance 1.4: GDPR, forælderen kan slette sin egen konto, FULDT GENNEMFØRT.)**

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
