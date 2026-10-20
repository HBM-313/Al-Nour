# Plan: Platformsmodning — fra "virker" til "professionel platform"
 
*Skrevet 2026-07-22 efter fuld kode- og databaseaudit (14.528 linjer kode, 15 tabeller, 18 migrationer, 2 edge functions). Læg denne i projektmappen sammen med instruktion.md, SKILL.md og handoff.md.*
 
---
 
## Sådan bruges planen
 
Planen er delt i **fire faser efter risiko**, ikke efter hvad der er sjovest at bygge. Hver fase har nummererede leverancer. **Én leverance pr. godkendelsescyklus** — samme arbejdsform som hidtil: demo/bevis → ejer godkender → port → typecheck/oxlint/build → commit → push.
 
Rækkefølgen er bevidst. Fase 0 handler om at kunne **se** fejl; fase 1 om at rette de fejl brugerne mærker; fase 2 om det der bliver dyrere jo længere vi venter; fase 3 om nyt indhold og nye funktioner.
 
**Princip gennem hele planen:** ingen ny funktionalitet bygges oven på et fundament der ikke kan testes eller overvåges. Derfor er tests og logging først — ikke fordi de er vigtigst for barnet, men fordi alt andet bliver utrygt uden dem.
 
Estimaterne er sessioner (ikke timer), ud fra det hidtidige tempo i projektet.
 
---
 
# FASE 0 — Se hvad der sker (fundament for alt andet)
 
*Uden dette arbejder vi i blinde. Appen er live, ejeren kan ikke køre kode lokalt, og der findes i dag hverken tests eller fejllogning. En fejl i produktion opdages først når et barn støder på den — og ingen får det at vide.*
 
## 0.1 — Test-framework + første tests på spilmotorerne
**Hvorfor først:** Der er 0 tests i 14.528 linjer. `pickRoundWords`-fejlen fra session 5 (kategori-tærskel) levede i produktion og blev fundet ved tilfælde. Den ville være fanget på 2 sekunder af en enhedstest. Al `engine.ts`-kode er ren logik uden DB-afhængighed — den er *gratis* at teste.
 
**Leverance:**
- Vitest opsat (passer til Vite-stakken, ingen ny build-kæde).
- `npm test` tilføjet til scripts; kører også i `npm run build`-kæden.
- Første testsuite på de tre mest kritiske motorer:
  - `match-par/engine.ts` (214 linjer) — inkl. regressionstest for kategori-tærskel-fejlen.
  - `lyt-og-find/engine.ts` (410 linjer) — distraktor-valg, ingen dubletter, lyd-fallback-kæde.
  - `tegn-bogstavet/tracing.ts` (377 linjer) — pixeldækning, glyf-klipning.
- Mål: ~40-60 tests. Ikke 100 % dækning — de *forgreninger hvor fejl er dyre*.
**Bevis:** `npm test` grøn, og én bevidst indsat fejl skal få suiten til at fejle.
**Estimat:** 1 session.
 
## 0.2 — ErrorBoundary + fejllogning
**Hvorfor:** I dag giver én render-fejl barnet en hvid skærm uden vej tilbage — og ejeren får det aldrig at vide. Planens §11 kræver "intern log så du ser hvad der fejler". Den findes ikke (0 `console.error`, ingen Sentry).
 
**Leverance:**
- `<ErrorBoundary>` om hele appen + om hvert spil separat (så en spilfejl ikke dræber hele skallen).
- Børnevenlig fejlskærm: rolig, dansk, ét stort "Prøv igen"-lys, aldrig en teknisk stak. Ingen eksterne links (børnesikkerhed).
- Ny tabel `error_log` (dataminimering: fejlbesked, komponent, tidsstempel, aldersskin — **aldrig** profil-id, navn eller andet persondata) + RLS: kun admin læser, alle kan skrive.
- Fail-soft: hvis logning fejler, må den aldrig kaste videre.
**Beslutning ejeren skal træffe:** egen `error_log`-tabel i Supabase (gratis, EU, ingen tredjepart, mest GDPR-rent) vs. Sentry (mere værktøj, men tredjepart + børnedata-overvejelser). **Anbefaling: egen tabel** — passer til "ingen tredjeparts-tracking"-princippet.
**Estimat:** 1 session.
 
## 0.3 — CI/CD (GitHub Actions)
**Hvorfor:** Ejeren kan ikke køre terminal. I dag deployer Cloudflare **alt** der pushes til `main` — også en build der ikke kompilerer. Der er intet sikkerhedsnet mellem push og børnene.
 
**Leverance:**
- `.github/workflows/ci.yml`: ved push + pull request → `npm ci` → `tsc --noEmit` → `oxlint src` → `npm test` → `npm run build`.
- Rød CI = tydeligt signal før Cloudflare når at deploye.
- (Senere, valgfrit: branch protection så `main` ikke kan modtage rødt build.)
**Estimat:** ½ session.
 
---
 
# FASE 1 — Ret det brugerne mærker
 
*Fejl der påvirker børn og forældre lige nu, i den live app.*
 
## 1.1 — Offline-fremskridt (kø + synk)
**Hvorfor:** Det største brud på et *kerneløfte*. Planen §11 lover fuldt offline med synk ved næste online-adgang. Virkeligheden: `progress.ts` skriver direkte til Supabase uden kø — spiller barnet offline, er fremskridtet **tabt**. Målgruppen er familier der deler én enhed, ofte med ustabilt net. Dette er den mest brugersynlige fejl i platformen.
 
**Leverance:**
- Skrivekø i IndexedDB (ikke localStorage — tåler mere og blokerer ikke UI-tråden).
- `saveStepProgress`/`saveRoundProgress` skriver **altid** til køen først, forsøger derefter server; ved fejl bliver posten i køen.
- Synk-motor: tømmer køen ved `online`-event og ved app-start; idempotent (samme post to gange må ikke give dobbelt XP).
- Diskret status i børne-UI ("Dit lys gemmes, når du er online igen") — rolig, ikke alarmerende.
- Tests: kø overlever genstart, dobbeltsynk giver ikke dobbelt XP, konflikt løses forudsigeligt.
**Estimat:** 1-2 sessioner. Dette er den teknisk tungeste enkeltleverance i planen.
 
## 1.2 — Progress-gem som atomisk RPC (race condition)
**Hvorfor:** `progress.ts` laver læs-derefter-skriv uden transaktion. To faner, hurtige runder eller synk-genafspilning kan tabe XP eller ødelægge streak.
 
**Leverance:**
- Postgres-funktion `record_progress(profile_id, lesson_id, earned_xp, current_step, completed)` — al streak- og XP-logik flyttet ind i databasen, i én sætning.
- Frontend kalder RPC i stedet for select+upsert.
- Mur-stil regressionstest (`DO $$`, rollback-markør, 0 rækker efterladt): samtidige kald må ikke tabe XP; barn kan kun skrive eget fremskridt.
**Bemærk:** skal bygges *sammen med* 1.1 — køen skal kalde den samme RPC, ellers får vi to kodeveje der driver fra hinanden.
**Estimat:** 1 session (kan slås sammen med 1.1).
 
## 1.3 — Streak flyttes til profilen (rigtig streak)
**Hvorfor:** Streak ligger i dag på `progress` med `UNIQUE(profile_id, lesson_id)` — altså **én streak pr. lektion**. Et barn der spiller trofast hver dag, men skifter lektion, ser evigt "streak = 1". Det virker stik imod hensigten og er pædagogisk demotiverende.
 
**Leverance:**
- `profiles.streak_count` + `profiles.last_active_day` (dato, ikke tidsstempel — undgår tidszonefejl).
- `record_progress` opdaterer den globale streak; `progress.streak_count` bevares som historik eller udfases bevidst (dokumenteres i migrations-README).
- Dashboard + børne-UI viser den rigtige streak.
**Estimat:** ½ session (oven på 1.2).
 
## 1.4 — GDPR: forælderen kan slette sin egen konto
**Hvorfor:** Barnets data kan slettes med ét klik. **Forælderens egen konto kan ikke** — der er ingen DELETE-policy på `accounts` (verificeret i `pg_policies`). Art. 17 gælder også den voksne. Dette skal være på plads før offentlig lancering.
 
**Leverance:**
- SECURITY DEFINER-RPC `delete_own_account()`: sletter `auth.users`-rækken → cascade rydder `accounts` → `profiles` → `progress`. Verificér hele cascade-kæden **først** og skriv manglende led eksplicit i migrationen.
- UI i forælder-portalen: to-trins bekræftelse, klar dansk tekst om hvad der forsvinder (alle børn, alt fremskridt, alt).
- Regressionstest der beviser at intet forældreløst data står tilbage i nogen tabel.
**Estimat:** 1 session.
 
---
 
# FASE 2 — Det der bliver dyrere for hver dag
 
*Ting hvor prisen stiger med hver ny skærm vi bygger. Derfor før nyt indhold.*
 
## 2.1 — i18n-lag
**Hvorfor nu:** Alle danske strenge er hardcodede i ~14.500 linjer. Planen (§9) kræver at hele UI'et — inklusive admin — kan skifte sprog, dansk + arabisk fra start. **Hver ny skærm vi bygger uden i18n fordobler den fremtidige regning.** Bygger vi Hverdagshaven, spil 4 og figursystemet først, bliver refaktoreringen dobbelt så stor.
 
**Leverance:**
- Letvægts-i18n (ingen tung afhængighed nødvendig; `da.ts`/`ar.ts` som typede objekter + `useT()`-hook giver typesikkerhed og fanger manglende nøgler i typecheck).
- Migrering skærm for skærm, med dansk som kilde-sandhed.
- `dir`-håndtering pr. tekstblok (ikke globalt) — som SKILL.md kræver.
- Sprogvalg på profilen (`ui_language` findes allerede i skemaet, bruges ikke).
**Estimat:** 2 sessioner (mekanisk, men bredt).
 
## 2.2 — Transskriptions-toggle + niveau-progression
**Hvorfor:** To kernepædagogiske funktioner fra planen §5 som databasen understøtter, men koden ignorerer. `transliteration_enabled` og `current_level` læses aldrig fra profilen. Sprogprogressionen (niveau 1→4 med automatisk aftrapning af transskription) er platformens **pædagogiske rygrad** — den er beskrevet i tre dokumenter og eksisterer ikke i produktet.
 
**Leverance:**
- Profilen styrer transskription; forælder kan slå til/fra i dashboard; barn kan slå til igen (planens krav).
- Niveau-logik: aftrapning pr. niveau; indhold filtreres på `level`.
- Niveau-fremgang: enten automatisk via XP-tærskler eller forælder-styret — **ejerbeslutning**.
**Estimat:** 1-2 sessioner.
 
## 2.3 — Fejlrapport-knap ("noget er galt")
**Hvorfor:** `content_reports`-tabellen har stået tom og ubrugt siden Fase 0. Planen §11 kræver den ved *hvert* indhold. Med rigtige børn i appen er det din eneste kanal til at opdage forkert lyd, forkert ord eller en fejl i en aqidah-tekst.
 
**Leverance:**
- Diskret knap ved indhold (i forælder- og lærertilstand — **ikke** i børnetilstand, for at holde børne-UI'et rent og lukket).
- Admin-visning af indkomne rapporter med status.
**Estimat:** 1 session.
 
---
 
# FASE 3 — Nyt indhold og nye funktioner
 
*Først når fundamentet bærer.*
 
## 3.1 — Illustrationsstil-beslutning + billed-lag
**Blokerer:** 0 af 107 ord har billeder; 2 ord har hverken billede eller emoji. Match-par og soft-skinnet (3-6 år, som er *ikke-læsende*) er svækket uden billeder — for den yngste gruppe er billedet hele betydningsbæreren.
**Leverance:** stilbeslutning (ejer) → `image_media_id`-pipeline → upload/generering → tilkobling.
**Bemærk:** husk tidsstempel i filnavne (upsert-cache-fælden fra generate-audio).
**Estimat:** 1 session til pipeline; billedproduktion afhænger af stilvalg.
 
## 3.2 — `characters`-systemet (0 rækker i dag)
**Hvorfor:** Et helt designet system i planen §6 — ven-guide, region-venner, "mit navn betyder…"-øjeblikket — som **aldrig er bygget**. Det er en stor del af platformens varme og identitet, og "navnets betydning" er ægte læring (arv + sprog på én gang).
**Muren gælder:** figurer er nutidige børn der bærer navnene, aldrig imamerne, aldrig titler; `sacred_representation` håndhæves.
**Estimat:** 1-2 sessioner.
 
## 3.3 — Hverdagshaven + spil 4 "Vælg din vej"
**Hvorfor:** En af tre verdener er helt tom — 0 kode, 0 indhold. Akhlaq er prioritet 3 i projektets egen rækkefølge.
**Fordel:** AI-tilladt indhold — kan vokse ubegrænset uden godkenderflaskehals.
**Estimat:** 2 sessioner (spilmekanik + første valghistorier).
 
## 3.4 — Lektions-editor (CMS Fase B)
**Hvorfor:** Lektioner kan i dag kun ændres via rå SQL. Så længe kun du redigerer, er det til at leve med — men det er en flaskehals og en risiko (håndskrevet SQL mod produktion).
**Estimat:** 2 sessioner.
 
## 3.5 — Lærer/klasse-funktion
Planens Fase 3. Tabeller findes, tomme. Først når alt ovenstående står.
 
---
 
# Oprydning (løbende, ikke egne sessioner)
 
- Testkonto `test-foraelder@nour.test` + profilerne Ali/Zainab **slettes før lancering**.
- `check-google-voices`-funktion + ubrugt ElevenLabs-secret ryddes i Supabase.
- Juridisk gennemsyn af samtykketeksten før offentlig lancering (Claude er ikke jurist — dette skal en rigtig jurist se på).
- `ANTHROPIC_API_KEY` sættes når siden er 100 % færdig (ejerbeslutning 2026-07-20).
---
 
# Samlet rækkefølge
 
| # | Leverance | Fase | Est. |
|---|---|---|---|
| 1 | Test-framework + motortests | 0 | 1 |
| 2 | ErrorBoundary + fejllogning | 0 | 1 |
| 3 | CI/CD | 0 | ½ |
| 4 | Offline-kø + atomisk progress-RPC | 1 | 2 |
| 5 | Global streak | 1 | ½ |
| 6 | GDPR: slet egen konto | 1 | 1 |
| 7 | i18n-lag | 2 | 2 |
| 8 | Transskription + niveauer | 2 | 1-2 |
| 9 | Fejlrapport-knap | 2 | 1 |
| 10 | Illustrationsstil + billed-lag | 3 | 1+ |
| 11 | characters-systemet | 3 | 1-2 |
| 12 | Hverdagshaven + spil 4 | 3 | 2 |
| 13 | Lektions-editor | 3 | 2 |
| 14 | Lærer/klasse | 3 | — |
 
**Fase 0+1 = ca. 6 sessioner.** Det er den strækning der flytter Nour fra "virker når man er heldig" til "kan stå live med rigtige børn og ustabilt net". Jeg vil anbefale ikke at bygge nyt indhold før punkt 6 er i mål.
 
---
 
# Hårde krav (uændret gennem hele planen)
 
- **Muren:** aqidah aldrig AI; de hellige kun som lys; Quran-recitation human-only (DB-håndhævet, urørlig).
- RLS fail-closed; `ai_service` nul adgang til persondata/aqidah; role aldrig klient-styret.
- Skema-drift tjekkes på live-DB FØR migrationer (UNION ALL-mønstret med `::text`). `pgcrypto` = `extensions.`-prefix.
- Idempotente migrationer; mur-stil regressionstests (`DO $$`, rollback-markør, 0 rækker efterladt).
- Edge functions committes til repoet efter enhver deploy.
- Medie-filer til samme sti får tidsstempel i filnavnet.
- Ingen eksterne links/køb i børnetilstand. Dataminimering overalt — også i den nye `error_log`.
- Demo (simuleret backend) → ejer tester i telefonens rigtige browser → godkendelse → port → grøn build → commit → push med token indsat i chatten.
- Kirurgiske ændringer, fuld kørbar kode, ingen skitser. Svar på dansk. Ét skridt ad gangen. Spørgsmål som klikbare valgmuligheder.
