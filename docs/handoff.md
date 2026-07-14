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

**Status:** Fase 0 deployeret og verificeret. Supabase-projekt "Al-Nour" kører i eu-central-1 (EU ✓). Skema + RLS + aqidah-mur-trigger er live. Muren er hærdet efter fund af tre fail-open-huller (NULL-semantik, SECURITY DEFINER-identitet, claim-løse sessioner) — alle lukket og bevist med testserie: editor/service_role afvises, kun approver/admin (eller ejer via dashboard) kan udgive aqidah, kilde-verifikation påtvinges. ai_service kan kun indsætte ai_allowed-kladder, ikke opdatere, og kan ikke læse aqidah. Frontend-fundament bygget: Vite+React+Tailwind v4, PWA offline, RTL/LTR-komponenter (dir pr. blok), tre aldersskind, AI-pipeline-mur hardcodet.

**Fase 1-datalag (2026-07-14):** `letters` (28 bogstaver, hija'i-orden, fire former som GENEREREDE kolonner via tatweel — kan ikke drifte) og `vocabulary` (54 ord i 9 kategorier, koblet til startbogstav via `first_letter_id`, `register` fusha/everyday) er live og seedet. LYD-REGLEN er nu teknisk håndhævet: `trg_letters_audio_human` afviser AI-lyd og ukendte medier på bogstaver (fail-closed, testet). RLS: offentlig læsning, kun admin/editor skriver, ai_service har nul adgang. Drift-fix: `set_updated_at()` manglede helt i live — oprettet + triggere på 6 tabeller. TypeScript-typer (`Letter`, `VocabularyWord`) tilføjet i types.ts, typecheck OK.

**Lyt & Find (2026-07-14):** Første kernespil bygget i `app/src/features/lyt-og-find/` (engine.ts ren logik + useListenFind.ts hentning/tilstand/progress-gem + audio.ts + ListenFindGame.tsx). Tre aldersskind: soft = 2 kæmpevalg, ingen forkert-følelse; mid = 4 valg (bogstaver+ord), XP + dags-streak upsert i progress; teen = bogstav-former med samme-rasm-distraktorer (ب blandt ت ث ن). Distraktor-sværhedsgrad styres af visuelle ligheds-grupper. Lesson-række 'Lyt & Find' seedet i live (id eda50413-2e28-4de4-b331-80951d908e92). Spillet er lyd-drevet fra dag ét: medie-fil (human/AI) vinder, ellers browser-TTS-pladsholder, ellers tekst-fallback. Typecheck, oxlint og fuld PWA-build grønne.

**LYD-REGLEN ÆNDRET (ejer-beslutning 2026-07-14) — vigtigt for alle fremtidige sessioner:** AL lyd i projektet må være TTS/AI-genereret (fx ElevenLabs, Google) eller uploadet fil, og kan frit udskiftes. DEN ENESTE UNDTAGELSE: Quran-recitation skal være menneskelig (media_ai_never_recitation består urørt). Migration `20260714_fase1_lydregel_lempet.sql` er deployeret og testet: trg_letters_audio_human er ERSTATTET af trg_letters_audio_valid (AI-lyd accepteres nu ✓, recitation-markeret lyd på bogstaver afvises ✓, ukendt medie afvises fail-closed ✓). Spillet har fået TTS-pladsholder-kæde: medie-fil → browser-TTS → tekst-fallback. Dette er en BEVIDST lempelse — skal IKKE "rettes" tilbage. NB: SKILL.md/instruktion.md i Claude-projektmappen skal opdateres tilsvarende (gammel human-only-formulering står der stadig).

**Næste skridt:** AI-lydgenerering af de 28 bogstavnavne + ordforrådet (vælg leverandør: ElevenLabs eller Google TTS) og kobling via media-tabellen — så erstattes browser-TTS'en af rigtige filer.

**Åbne beslutninger / noter:**
- ~~SKEMA-DRIFT~~ LUKKET 2026-07-13: live `content` udvidet mod 0001-designet via `20260713_content_udvid_mod_0001.sql` (title_da/ar, sacred_representation, tre aldersvarianter, aqidah-constraints, indexes). Verificeret med testserie inkl. mur-regression. Bevidste blivende afvigelser dokumenteret i supabase/migrations/README.md.
- Valg af lyd-leverandør og illustrationsstil udestår.


---

## Sådan bruger jeg denne fil

1. Start ny session med instruktion.md + SKILL.md + denne handoff.md i projektmappen.
2. Opdater "Hvor jeg er nu" efter hver større milepæl, så næste session starter varmt.
3. Bed om ét konkret næste skridt ad gangen.
