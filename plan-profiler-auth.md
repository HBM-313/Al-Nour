# Plan: Profiler & Auth — næste milepæl (skrevet 2026-07-17)
 
*Til næste session. Læg denne i projektmappen sammen med instruktion.md, SKILL.md og handoff.md. Læs alle fire før arbejdet starter.*
 
---
 
## Udgangspunkt
 
TTS-milepælen er afsluttet (commit `449c81f`): Google Cloud TTS (Chirp3-HD, ar-XA) erstatter ElevenLabs, alle 164 klip genereret og ejer-verificeret. Se handoff.md → "TTS-status" for detaljer.
 
Nu bygges **profiler/auth** — den næste fundament-brik før klasse-funktionen. Ejer-godkendt retning (todo.md, mulighed A).
 
## Mål for milepælen
 
Tre leverancer, i denne rækkefølge, én ad gangen med ejer-godkendelse imellem:
 
1. **Barnets billede-pinkode-login** — vælg tre dyr i rækkefølge. Ingen email, ingen tekst-kode (plan §8). Barnet ser kun spil og fremskridt.
2. **Forældresamtykke-flow** — forælder opretter konto (Supabase Auth, email) og opretter børneprofiler; samtykke registreres eksplicit som retsgrundlag (plan §13). Børn opretter aldrig selv konti.
3. **Forældre-dashboard-skelet** — minimalt: liste over børneprofiler, opret/slet profil (ét-kliks sletning af barn + AL data, GDPR-krav), se fremskridt pr. barn. Mål-sætning/transskriptions-styring kan vente.
## Hårde krav (må ikke fraviges)
 
- **Dataminimering:** børneprofil = kun kaldenavn + fødselsår + avatar-valg. Aldrig fuldt navn, adresse, email på barnet.
- **RLS fail-closed som muren:** barnet ser KUN eget data; forælder KUN egne børn; `ai_service` nul adgang til persondata. Brug samme claim-mønster som eksisterende RLS (se `supabase/migrations/README.md` og mur-testene). Skriv regression-tests i samme stil: `DO $$`-blokke med `set local role`, exception-handlere, terminal `RAISE EXCEPTION 'ROLLBACK_MARKER'`.
- **Ingen eksterne links/køb i børne-tilstand** — login-skærm for barn er lukket, ren, uden navigation ud.
- **Skema-drift tjekkes FØR migrationer skrives:** query `information_schema.columns`, `pg_trigger`, `pg_constraint` på live-DB. `accounts.id = auth.uid()` og `profiles`-strukturen findes allerede (Fase 0) — udvid, omskriv ikke. Dokumentér bevidste afvigelser i migrations-README, "ret" aldrig de eksisterende dokumenterede afvigelser.
- **Migrationer idempotente** med `where not exists`-guards.
## Eksisterende kode der skal kobles om (forberedt, se handoff.md)
 
- `lib/localProgress.ts` — anonym gæste-fremskridt i localStorage. Skal bestå som fallback; databasen tager over når en profil er logget ind. Overvej engangs-migrering af localStorage-fremskridt ind i profilen ved første login ("tag dit fremskridt med").
- `lib/voicePref.ts` — stemmevalg (kvinde/mand) i localStorage; flyttes til profilen (feltet bør hedde noget i stil med `preferred_voice` på profiles). `preferredAudioId()` er fail-soft og skal forblive det.
- `progress.current_step` + per-trin-gem — virker allerede pr. (lektion, skind); skal blot pege på profile_id i stedet for/ved siden af localStorage-nøglen.
## Beslutninger ejeren skal træffe undervejs (spørg, antag ikke)
 
1. **Dyre-pinkodens udformning:** hvilke dyr (antal i grid, fx 9 eller 12), og skal rækkefølgen vises som hjælp for de mindste (3–6-skindet)? Foreslå et konkret design via Visualizer-demo først.
2. **Forkert-pinkode-adfærd for børn:** ingen "straf", men hvad sker der efter gentagne fejl? (Foreslå: blid besked + "hent en voksen"-mulighed, aldrig lockout af barnet alene.)
3. **Samtykke-tekstens indhold:** Claude må skrive udkast til dansk, letforståelig samtykke-/privatlivstekst, men ejeren godkender ordlyden før den går ind i UI'et. Claude er ikke jurist — sig det eksplicit, og anbefal juridisk gennemsyn før offentlig lancering.
4. **Skal gæste-tilstand bestå permanent** ved siden af profiler, eller kun som "prøv uden konto"-indgang med opfordring til forældreopsætning?
## Arbejdsform (uændret — se instruktion.md)
 
- Visualizer-demo → ejer tester → godkendelse → port til repo → commit/push (ejer indsætter token pr. session; roter efter deling).
- Kirurgiske ændringer; fuld kørbar kode, ingen skitser.
- Ét konkret næste skridt ad gangen; start med leverance 1 (billede-pinkoden som isoleret demo).
- Svar på dansk.
## Første konkrete skridt i sessionen
 
Tjek live-skemaet for `accounts`/`profiles` (kolonner, RLS, triggere) → foreslå migration for de manglende felter (pinkode-hash — ALDRIG klartekst, selv for dyre-koder; `preferred_voice`; samtykke-felter med tidsstempel) → vis pinkode-login som Visualizer-demo med de tre aldersskind for øje (3–6 er primær målgruppe for billede-login).
 
## Kendte efterladenskaber fra TTS-sessionen (lav-prioritet oprydning)
 
- `check-google-voices`-testfunktionen i Supabase kan slettes via dashboard.
- ElevenLabs' `TTS_API_KEY`-secret er ubrugt og kan fjernes.
- GitHub-token delt 2026-07-17 → skal roteres (ejer-handling).
