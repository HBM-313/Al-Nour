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

**Næste skridt:** Fase 1 — Bogstavernes Dal: alfabet-data (28 bogstaver med lyd/former), første ~50 ord, Lyt & Find-spillet.

**Åbne beslutninger / noter:**
- ~~SKEMA-DRIFT~~ LUKKET 2026-07-13: live `content` udvidet mod 0001-designet via `20260713_content_udvid_mod_0001.sql` (title_da/ar, sacred_representation, tre aldersvarianter, aqidah-constraints, indexes). Verificeret med testserie inkl. mur-regression. Bevidste blivende afvigelser dokumenteret i supabase/migrations/README.md.
- Valg af lyd-leverandør og illustrationsstil udestår.


---

## Sådan bruger jeg denne fil

1. Start ny session med instruktion.md + SKILL.md + denne handoff.md i projektmappen.
2. Opdater "Hvor jeg er nu" efter hver større milepæl, så næste session starter varmt.
3. Bed om ét konkret næste skridt ad gangen.
