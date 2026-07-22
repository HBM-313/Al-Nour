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
**Token:** gemmes IKKE i repoet (GitHub push-beskyttelse afviser det). Tokenen ligger i den lokale handoff.md i Claude-projektmappen.

## Roller

Admin (mig) · Indholds-redaktør (kan ikke udgive aqidah) · Godkender (eneste der kan sætte aqidah live).

---

## Hvor jeg er nu (opdater dette felt løbende)

**Status (2026-07-22, session 11 — Leverance 1.1 + 1.2: offline-kø + atomisk `record_progress`-RPC, GENNEMFØRT.)**
Se `supabase/migrations/README.md` → "record_progress-RPC + event-idempotens" for den fulde tekniske beskrivelse af 1.2. Kort resumé af begge leverancer:

- **1.2 — atomisk RPC:** `progress.ts`s tidligere læs-derefter-skriv er erstattet af én atomisk Postgres-funktion `record_progress()` (`INSERT ... ON CONFLICT DO UPDATE`). Xp forbliver additiv (delta pr. runde, som hidtil) — IKKE kumulativ, det var en fejlantagelse i en tidlig, forkastet v1 af RPC'en (se README for detaljer). Idempotens sikres af en ny tabel `progress_events` (fail-closed RLS, ingen policies — kun RPC'en rører den): hvert kald bærer et `event_id`, og en gentagelse af samme id er et bevidst no-op. Streak-regel (samme dag/i går/nulstil) og step-reset ved fuldførelse er flyttet uændret fra frontend ind i RPC'en. Ejerskabs-tjek som `set_child_pin`. Bevist med 11-punkts rollback-markør-regressionstest mod live-DB, 0 rækker persisteret.
- **1.1 — offline-kø:** nyt modul `lib/progressQueue.ts` — IndexedDB-baseret FIFO-skrivekø (ikke localStorage). `saveStepProgress`/`saveRoundProgress` skriver ALTID til køen først og forsøger straks afsendelse; lykkes det ikke (offline), bliver posten trygt liggende og forsøges igen. Rækkefølgen bevares strengt (`flushQueue` stopper ved første fejl i stedet for at springe entries over), fordi `current_step` sættes direkte i RPC'en, ikke monotont. `startSyncEngine()` tømmer køen ved app-start og på hvert `online`-event — wired ind i `useAppShell.ts`. Injicerbar afsender (samme DI-mønster som `errorLog.ts`) gør hele køen testbar uden Supabase/netværk: 9 nye tests (`progressQueue.test.ts`, `fake-indexeddb` som ny devDependency) dækker idempotens, FIFO-rækkefølge, kø-overlevelse ved simuleret "genstart", og online-sync.
- Build-kæde grøn: `tsc --noEmit` 0 fejl · `oxlint` 0/0 · **93/93 tests** · build ✓. (Sidefund: `npm audit fix` ryddede en pre-eksisterende `fast-uri`-sårbarhed via `vite-plugin-pwa`-kæden, uafhængigt af denne leverance.)
- **Ikke bygget endnu:** den diskrete UI-status-tekst ("Dit lys gemmes, når du er online igen") i børne-UI'et. Kø-logikken (`getPendingCount()`) er klar til at drive den, men selve UI'et mangler stadig sin Visualizer-demo og ejer-godkendelse, jf. det etablerede mønster.

**Dokumentations-fund (flag til ejer, ikke rettet her):** denne fils historik stopper ved 2026-07-17 (TTS-status) FØR denne sessions opdatering. Sessionerne 6–10 (test-framework, ErrorBoundary/fejllogning, CI/CD m.m. — se Claude-projektmappens handoff.md for fuld status) er tilsyneladende aldrig blevet committet til `docs/handoff.md` i selve repoet, kun til Project-filen. De to filer er dermed drevet fra hinanden før nu. Bør reconcileres i en kommende session.

**Næste skridt:** Visualizer-demo af den diskrete "gemmes offline"-status → ejer-godkendelse → port. Derefter Leverance 1.3 (streak flyttes til profilen — global i stedet for lektions-specifik) og 1.4 (GDPR: forælderen kan slette sin egen konto). Se `plan-platformsmodning.md` §1.3–1.4.

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
