# Plan: Børnesession & forældre-dashboard
 
*Skrevet 2026-07-23, efter Leverance 1.3 (global streak, commit `a5488a8`). Læg denne i projektmappen sammen med instruktion.md, SKILL.md, handoff.md og plan-platformsmodning.md.*
 
*Denne plan indsætter to nye blokke i `plan-platformsmodning.md`: en sikkerheds-/arkitekturblok (fase 1½) og en indholdsblok på dashboardet (fase 3). Den erstatter ikke planen — den udvider den.*
 
---
 
# DEL 1 — Problemet, præcist formuleret
 
## 1.1 Barnet spiller i dag inde i forælderens session
 
Sådan ser den nuværende kæde ud:
 
1. Forælderen logger ind med e-mail + adgangskode → Supabase Auth udsteder en JWT for forælderens `accounts`-række.
2. App-skallen skifter til "barnets tilstand": profilvælger → dyre-pin → verdenskort.
3. **Den JWT der ligger i browserens storage er stadig forælderens.** Dyre-pinnen er en UI-port, ikke en identitet.
Alt hvad barnet foretager sig — `record_progress`, læsning af profiler, alt — sker med forælderens rettigheder. Forældre-portalen bag adgangskode-genindtastning er en pæn ekstra dør, men den beskytter kun *skærmen*, ikke *nøglen*: nøglen ligger allerede i lommen på enheden.
 
## 1.2 Tre konkrete konsekvenser
 
**a) Skadesradius.** Enhver fejl der lader nogen slippe ud af børne-tilstanden — en render-fejl, en dyb-link, en fremtidig bug, en nysgerrig 11-årig med udviklerværktøjer — giver fuld adgang til forælderens konto: slet alle børneprofiler, slet alt fremskridt, læs forælderens e-mail. Vi har bygget en fail-closed mur i databasen og efterladt hoveddøren på klem i klienten.
 
**b) Friktion, der rammer netop vores målgruppe.** Planen siger eksplicit: familier der deler én enhed. Med den nuværende model skal en voksen være til stede og taste sin adgangskode, hver gang sessionen udløber. Barnet kan ikke bare tage tabletten og øve ti minutter. Det er den mest almindelige brugssituation, og den er i dag den dårligst understøttede.
 
**c) Søskende deler identitet.** Ali og Zainab har separate profiler, men samme session. Databasen kan ikke skelne dem — kun UI'et kan. Med Leverance 1.3's globale streak er det nu også emotionelt: en streak er noget der *tilhører* barnet.
 
## 1.3 Hvad "gæste-tilstand" ikke løser
 
Gæste-tilstanden findes allerede (localStorage, `lib/localProgress.ts`, migreringsprompt "Tag lyset med?"). Den lader barnet spille uden konto — men fremskridtet lever kun på enheden og når aldrig forælderens dashboard. Den er en prøve-indgang, ikke et svar på "barnet bruger platformen selvstændigt, og forælderen kan følge med".
 
---
 
# DEL 2 — Målbilledet
 
Sådan skal det føles, når det er bygget:
 
**Barnets vej (ingen voksen påkrævet efter opsætning):**
1. Barnet åbner appen på familiens enhed.
2. Appen åbner direkte på profilvælgeren — Ali's lanterne, Zainab's lanterne.
3. Barnet trykker sin egen lanterne → dyre-pin → **sin egen session**.
4. Spiller. Alt fremskridt gemmes på barnets egen identitet, synkes når der er net.
5. Barnet kan ikke — hverken i UI eller i databasen — se søskendes data, forælderens e-mail, slette-knapper eller nogen indstilling ud over sine egne (stemme, transskription).
**Forælderens vej:**
1. Et diskret "Forælder"-punkt i hjørnet.
2. E-mail + adgangskode → forælder-portalen.
3. Ser alle sine børn, deres fremskridt, styrer indstillinger, sletter.
4. Går tilbage → appen falder tilbage til profilvælgeren.
**Nøglepointen:** barnets session og forælderens session er to forskellige identiteter i databasen, ikke to skærme i den samme session. Muren flytter fra UI'et ned i RLS, hvor resten af projektets sikkerhed allerede bor.
 
---
 
# DEL 3 — Løsningsvalg
 
Tre veje er reelt mulige. Jeg gennemgår alle tre, fordi valget binder os i lang tid.
 
## Mulighed A — Egen Supabase-auth-bruger pr. barn ⭐ ANBEFALET
 
Hver børneprofil får en rigtig `auth.users`-række med en **syntetisk e-mail** (fx `c-<profil-uuid>@child.nour.invalid` — `.invalid` er reserveret af RFC 2606 og kan aldrig rutes nogen steder) og en tilfældig adgangskode, som intet menneske nogensinde kender eller ser.
 
Login-vejen: en Edge Function modtager `profile_id` + dyre-sekvens → verificerer pin mod `pin_hash` (bcrypt, `extensions.crypt`) med rate limiting → udsteder en rigtig session via Supabase Admin-API'et (magic-link-token som klienten indløser med `verifyOtp`).
 
**Fordele:**
- Rigtig identitet i `auth.uid()` → RLS gør arbejdet, som overalt ellers i projektet. Ingen ny sikkerhedsmodel at vedligeholde.
- Rigtig refresh-token-håndtering — barnet forbliver logget ind på tværs af app-genstarter, gratis.
- Passer ind i det eksisterende access-token-hook-mønster.
**Ulemper:**
- Børn tæller som aktive brugere i Supabase-forbrug. Kendt, kedelig, forudsigelig omkostning.
- Sletning skal rydde både `profiles`-rækken og auth-brugeren (løses med trigger, se 4.3).
**GDPR-vurdering:** ingen ny persondata. Den syntetiske e-mail er afledt af en uuid vi allerede har og indeholder intet om barnet. Auth-rækken rummer mindre om barnet end `profiles` gør i forvejen. Argumentet over for en tilsynsmyndighed er faktisk *stærkere* med denne model: barnet har sin egen, minimale identitet og kan teknisk ikke tilgå forælderens data.
 
## Mulighed B — Selvsigneret barne-JWT uden auth-bruger
 
Edge Function verificerer pin og signerer selv en JWT med projektets JWT-hemmelighed, med et `child_profile_id`-claim. RLS-politikker læser claimet.
 
**Fordele:** nul rækker i `auth.users` for børn — den reneste dataminimerings-fortælling.
**Ulemper, og de er tunge:**
- Ingen refresh-flow. Vi skal selv bygge fornyelse, udløb og tilbagekaldelse — altså vores egen auth. Det strider mod projektets princip om lagdelt, kedelig, gennemprøvet sikkerhed.
- Supabase bevæger sig mod asymmetriske signeringsnøgler; den delte JWT-hemmelighed er en vej der langsomt lukkes. Vi ville bygge på et fundament med udløbsdato.
- `auth.uid()` ville pege på en profil-id, ikke en konto-id. Alle eksisterende politikker antager det modsatte. De ville fejle lukket (godt), men enhver fremtidig politik bliver en fælde.
**Vurdering:** afvist. Gevinsten (ingen auth-rækker) er kosmetisk; prisen er vores egen auth-implementering.
 
## Mulighed C — Ingen barne-identitet, kun snævre RPC'er
 
Enheden indrulleres én gang og får en uigennemsigtig enheds-token; alle barne-operationer går gennem SECURITY DEFINER-RPC'er.
 
**Vurdering:** afvist som primær model. Den erstatter fire lag (constraint → trigger → RLS → pipeline) med ét lag ("RPC'en er omhyggelig"). Det er præcis den arkitektur projektet bevidst har fravalgt overalt ellers.
 
## Anbefaling
 
**Mulighed A.** Enhedsindrullering fra mulighed C genbruges dog i let form — ikke som sikkerhedsmekanisme, men som *bekvemmelighed*: enheden husker familiens profil-liste lokalt (se 4.2), så profilvælgeren kan vises uden nogen session og også virker offline.
 
---
 
# DEL 4 — Leverancer
 
Fire leverancer, én pr. godkendelsescyklus, samme arbejdsform som hidtil.
 
## Leverance B1 — Barnets identitet i databasen
 
**Bygges:**
- `profiles.auth_user_id uuid unique references auth.users(id)` — nullable indtil profilen er "aktiveret".
- SECURITY DEFINER-RPC eller Edge Function `provision_child_auth(profile_id)`: opretter auth-brugeren med syntetisk e-mail + kryptografisk tilfældig adgangskode, sætter `auth_user_id`. Kaldes af forælderen ved profil-oprettelse **og** bagudkompatibelt for eksisterende profiler.
- **Udvidelse af det eksisterende access-token-hook:** i dag slår hooket `accounts.role` op. En barne-auth-bruger har ingen `accounts`-række. Hooket skal derfor: findes en `profiles`-række med `auth_user_id = <uid>` → sæt `user_role: 'child'` og `profile_id: <uuid>` som claims.
  *Verificér FØRST hvad `auth_user_role()` returnerer for en bruger uden accounts-række — forventningen er `null` (fail-closed), men det skal bevises, ikke antages.*
- RLS for rollen `child`, alle fail-closed som udgangspunkt:
  - `profiles`: SELECT kun egen række (`id = (auth.jwt()->>'profile_id')::uuid`). UPDATE kun på en hvidliste af felter barnet selv må styre (`preferred_voice`, `transliteration_enabled`) — **aldrig** `pin_hash`, `owner_account_id`, `birth_year`, `display_name`.
  - `progress`: SELECT kun egne rækker. Skrivning sker udelukkende via RPC.
  - `accounts`: nul adgang (bør allerede følge automatisk — bevis det).
  - `content`/`letters`/`vocabulary`/`lessons`: uændret offentlig læsning.
- `record_progress()` udvides: accepterer nu enten forælder-ejerskab, admin, **eller** at kaldet kommer fra barnets egen session (`profile_id`-claimet matcher `p_profile_id`). Ejerskabstjekket er ét sted i funktionen — det er en kirurgisk ændring, men den mest sikkerhedskritiske linje i hele projektet. Behandl den derefter.
**Bevis (mur-stil regressionstest, rollback-markør, 0 rækker efterladt):**
1. Barnets session kan læse sin egen profil ✓
2. Barnets session kan **ikke** læse søskendes profil ✓
3. Barnets session kan **ikke** læse nogen `accounts`-række ✓
4. Barnets session kan **ikke** sætte sit eget `pin_hash` eller flytte `owner_account_id` ✓
5. Barnets session kan gemme eget fremskridt via `record_progress` ✓
6. Barnets session kan **ikke** gemme fremskridt på søskendes profil ✓
7. Forælderens session kan stadig alt det den kunne før (ingen regression) ✓
8. `ai_service` har fortsat nul adgang til alt dette ✓
**Estimat:** 1½ session. Dette er den tungeste og mest sikkerhedskritiske leverance i planen.
 
## Leverance B2 — Pin-login der udsteder en rigtig session
 
**Bygges:**
- Edge Function `child-signin`: modtager `profile_id` + dyre-sekvens → bcrypt-verifikation → udsteder session. **Skriver aldrig andet end forsøgstælleren.**
- **Rate limiting, og det er ikke valgfrit.** Med 9 dyr og en sekvens på 3 uden gentagelse er der 504 kombinationer. Uden begrænsning er en pin gættet på sekunder. Tabel `pin_attempts(profile_id, window_start, attempt_count)`. Regel: **stigende forsinkelse, aldrig lockout af barnet** (jf. plan-profiler-auth.md — barnet må ikke straffes). Efter 5 fejl: blid besked + "hent en voksen". Forælderen kan altid nulstille pin fra portalen.
- Enheds-lokal familie-roster: ved første vellykkede login gemmes `{profile_id, display_name, avatar}` for familiens børn i localStorage. **Aldrig `pin_hash`, aldrig noget andet.** Det er denne cache der lader profilvælgeren vises uden session og offline.
- "Glem denne enhed"-knap i forældre-portalen, der rydder rosteren.
- Skiftet mellem barn og forælder: eksplicit `signOut()` + ny `signIn`. To identiteter, aldrig begge aktive.
**Estimat:** 1 session.
 
## Leverance B3 — Sletning og livscyklus, ende til ende
 
Denne leverance er dér hvor Leverance 1.4 (GDPR: slet egen konto) og børnesessionen mødes. **Bygges de hver for sig, skal 1.4 laves om bagefter** — derfor står de her sammen.
 
**Bygges:**
- Trigger på `profiles` DELETE → slet den tilhørende auth-bruger. Ellers efterlader ét-kliks-sletningen af et barn en forældreløs auth-række — et GDPR-brud i en funktion hvis hele formål er GDPR.
- `delete_own_account()` udvides: forælderens sletning skal rydde forælderens auth-bruger, alle børns `profiles`-rækker, alle børns auth-brugere, alt fremskridt, `progress_events`, `pin_attempts`, klassemedlemskaber.
- Regressionstest der scanner **alle** relevante tabeller og beviser at intet forældreløst står tilbage. Skriv den som en løkke over tabelnavne, ikke som håndskrevne tjek — så fanger den også fremtidige tabeller vi glemmer.
**Estimat:** 1 session.
 
## Leverance B4 — Skallen bygget om til to indgange
 
**Bygges:**
- App-skallen åbner på profilvælgeren (fra den lokale roster), ikke på forælder-login.
- Første gang på en ny enhed: "Er du forælder eller barn?" → forælder logger ind og indruller enheden.
- Forældre-portalen kræver e-mail + adgangskode. Den nuværende genindtastnings-port udgår — den var en løsning på et problem vi nu fjerner.
- **Fejlsoft for børn:** udløber barnets token midt i et spil, må der ALDRIG komme en login-væg op foran et barn. Skrivninger falder i køen, spillet kører videre, sessionen fornys stille i baggrunden.
**Estimat:** 1 session (+ demo-runde).
 
---
 
# DEL 5 — Fælder jeg allerede kan se
 
Disse er fundet ved gennemgang af den eksisterende kode. De skal med i de respektive leverancer.
 
## 5.1 Skrivekøen vil gå i baglås ved profilskift ⚠️ VIGTIGST
 
`lib/progressQueue.ts` er én IndexedDB-kø, delt af hele enheden, og `flushQueue` **stopper ved første fejl** for at bevare rækkefølgen (bevidst valg fra Leverance 1.1).
 
I den nye model: Ali spiller offline, har uafsendte poster i køen. Ali logger ud, Zainab logger ind. Køen forsøger at sende Ali's poster med Zainabs JWT → `record_progress` afviser ("ikke autoriseret") → køen stopper ved første fejl → **Zainabs fremskridt kan aldrig komme igennem, permanent.**
 
Det er en reel, forudsigelig fejl som den nye arkitektur ville indføre. Løsning (vælges i B2): enten én kø pr. `profile_id`, eller en flush der springer poster over som ikke tilhører den aktive session i stedet for at stoppe. Jeg hælder til **kø pr. profil** — det er det simpleste at ræsonnere om, og rækkefølgegarantien inden for én profil bevares uændret. Skal have egne tests.
 
## 5.2 Offline-løftet gælder først efter første login på enheden
 
Pin-verifikation kræver serveren. Er enheden offline **og** barnet aldrig logget ind på den enhed før, kan barnet ikke komme ind. Vi kan ikke cache `pin_hash` lokalt — det ville udlevere hashen.
 
Ærlig konklusion, som skal stå i dokumentationen: **offline spil virker efter første online login på den enhed.** Har barnet en gyldig (også udløbet) session i storage, går de direkte ind; læsninger kommer fra PWA-cachen, skrivninger i køen. Det dækker den reelle brugssituation — familien har haft net på et tidspunkt.
 
## 5.3 Profiler uden pin
 
Pin er i dag valgfri ("profilen er ulåst — forælderens valg"). Når vi udsteder rigtige sessioner, betyder ulåst at et tryk på avataren giver barnets session. Skadesradius er én søskendes fremskridt — ikke intet, men lille. **Beslutning til ejeren** (se del 7).
 
## 5.4 Éns-forælder-antagelsen
 
`profiles.owner_account_id` er én enkelt nøgle. I virkeligheden er der ofte to forældre. Opretter mor kontoen, kan far ikke se noget.
 
**Bygges ikke nu**, men skal ikke spærres: en fremtidig `profile_guardians(profile_id, account_id, relation)`-tabel kan lægges oveni additivt uden at røre `owner_account_id`. Nævnt her, så vi ikke maler os op i et hjørne.
 
## 5.5 Access-token-hooket kan ikke konfigureres via SQL
 
Selve aktiveringen skete manuelt i dashboardet (kendt fra tidligere session). Funktionens *krop* kan vi ændre via SQL — men hvis hookets konfiguration nogensinde skal røres, er det en ejer-handling i dashboardet. Planlæg derefter.
 
---
 
# DEL 6 — Forældre-dashboardet: hvad der reelt er værd at bygge
 
Det nuværende dashboard (Leverance D) kan: liste børn, vise fremskridt, slette, styre pin. Det er administration. Det svarer ikke på det en forælder faktisk spørger om.
 
**Designprincip gennem hele dashboardet:** en forælder vil vide *lærer mit barn noget, og hvad kan jeg gøre sammen med dem?* — ikke *hvor mange minutter var de inde?* Vi bygger et vindue ind i barnets lys, ikke et overvågningspanel.
 
## 6.1 Oversæt spil-tal til lærings-tal ⭐ højest værdi pr. arbejdstime
 
XP er spilvaluta. Den siger en forælder ingenting. Vis i stedet:
 
- **Bogstaver barnet kan** — 17 af 28, med hvilke.
- **Ord barnet kan** — 34 af 107, fordelt på kategorier.
- **Streak** (nu ægte og global, efter Leverance 1.3).
- **Sidst aktiv** — som en dato, ikke som en tidsforbrugsmåling.
De to første kræver data vi ikke har i dag. Se 6.2.
 
## 6.2 Item-statistik — fundamentet under alt det gode
 
Nyt, lille datalag: `profile_item_stats(profile_id, item_type, item_id, seen_count, correct_count, last_seen_day)`.
 
**Bevidst designet som tællere, ikke som en hændelseslog.** Vi gemmer "Ali har set ب 14 gange og haft ret 11" — ikke "Ali svarede forkert kl. 19:42 tirsdag". Det er den mindst indgribende form der stadig kan svare på det pædagogisk relevante, og det er en betydeligt renere GDPR-position end en event-log. `last_seen_day` er en **dato**, ikke et tidsstempel (samme begrundelse som i Leverance 1.3).
 
Dette låser op for:
 
- **"Her kæmper barnet lidt"** — det mest værdifulde en forælder kan få, og næsten ingen læringsapp leverer det. *"Ali forveksler ofte ب og ت — de ligner hinanden, kun prikkerne adskiller dem."* Data findes allerede i spillenes distraktor-logik; den skal bare gemmes.
- **"Her er barnet stærk"** — mindst lige så vigtigt at vise.
- Senere: klasse-oversigt for lærere kan aggregere den samme tabel uden redesign.
**Estimat:** 1 session for datalaget + skrivning fra de tre spil, 1 session for dashboard-visningen.
 
## 6.3 "Gør dette sammen i denne uge"
 
Én konkret, kort opfordring pr. barn, afledt af 6.2:
 
> **Denne uge: øv ب, ت og ث sammen.**
> Sig بَاب (bab — dør) hver gang I går gennem en dør. Tre gange om dagen er nok.
 
Det knytter appen til det levede familieliv, som er hele missionen. Indholdet er sprogøvelser og hverdagsscenarier — **AI-tilladt**, muren berøres ikke. Kan være kuraterede skabeloner udfyldt med barnets svage bogstaver; ingen fri AI-generering nødvendig.
 
## 6.4 Indstillinger der allerede findes i skemaet, men aldrig bruges
 
Tre kolonner ligger ubrugte og er ren gevinst at koble på:
 
- `transliteration_enabled` — forælder slår transskription til/fra; **barnet kan altid slå den til igen** (planens udtrykkelige krav).
- `current_level` — sprogniveau 1–4. Det er platformens pædagogiske rygrad og eksisterer i dag kun på papir. (Dette er `plan-platformsmodning.md` §2.2 — bør bygges her, i dashboardet, hvor det hører hjemme.)
- `ui_language` — dansk/arabisk grænseflade.
Plus **dagens mål** som nyt, lille felt: "1 lektion om dagen". Bevidst et *mål*, ikke en *spærring* — vi låser aldrig et barn ude af at lære. Passer til lys-metaforen: målet nået = lanternen lyser fuldt den dag.
 
## 6.5 Forælderens egne ord
 
Planens §12: forældre kan tilføje ord barnet skal lære. Højt kulturelt værdi — familiens egne navne, den mad de spiser, ordene bedstemor bruger.
 
**Vigtigt teknisk:** disse ord må **ikke** ind i `vocabulary` (admin/editor-only, globalt indhold). Egen tabel `custom_words`, ejet af kontoen, RLS-afgrænset til familien, aldrig synlig for andre. Lyd via samme TTS-vej som resten.
 
## 6.6 "Prøv selv"
 
En knap der lader forælderen spille barnets lektion. Billig at bygge (spillene findes), og den bygger tillid: forælderen ser med egne øjne hvad barnet møder. Undervurderet funktion.
 
## 6.7 Hvad vi bevidst IKKE bygger
 
- **Sammenligning med andre børn.** Ingen percentiler, ingen "Ali er hurtigere end 60 %". Planen forbyder konkurrence i børnedelen, og for et barn der lærer sit arv-sprog er sammenligning direkte skadelig.
- **Tidsforbrugs-overvågning.** Ingen "skærmtid i dag"-grafer. Vi måler læring, ikke tilstedeværelse.
- **Adfærdsanalyse.** Ingen tredjeparts-analytics på børn. Uændret princip.
- **Notifikationer der trækker barnet tilbage i appen.** Ingen engagement-mekanik rettet mod børn. En *forælder*-tilvalgt ugentlig opsummering er derimod legitim — men senere, og aldrig som standard.
---
 
# DEL 7 — Åbne beslutninger (stilles som klikbare valgmuligheder i den relevante session)
 
1. **Skal pin være obligatorisk**, når barne-sessioner er rigtige sessioner? (Ulåst = ét tryk giver den søskendes session. Forslag: gør pin obligatorisk for børn over ~7 år, valgfri for de mindste, hvor pin i sig selv er en barriere for adgang.)
2. **Må forælderens session overleve**, mens barnet spiller (bekvemmelighed), eller skal der logges helt ud (sikkerhed)? *Min anbefaling: log helt ud. Ligger forælderens fornyelsestoken på enheden, er hele øvelsen delvist spildt.*
3. **Antal dyr i pin-grid'et** — 9 giver 504 kombinationer, 12 giver 1320. Med rate limiting er 9 forsvarligt; 12 er mærkbart bedre og koster kun skærmplads.
4. **Item-statistik: ja eller nej?** Den låser dashboardets bedste funktioner op, men er ny data om et barn. Min vurdering: ja, som rene tællere — det tjener barnet direkte og er langt mindre indgribende end en hændelseslog. Men det er dit kald, ikke mit.
5. **Rækkefølge** — se del 8.
---
 
# DEL 8 — Rækkefølge og estimater
 
| # | Leverance | Blok | Est. |
|---|---|---|---|
| 1.4 | GDPR: slet egen konto | fase 1 | 1 |
| B1 | Barnets identitet i DB (RLS + RPC + hook) | fase 1½ | 1½ |
| B2 | Pin-login udsteder rigtig session + rate limit + kø-fix | fase 1½ | 1 |
| B3 | Sletning ende til ende (udvider 1.4) | fase 1½ | 1 |
| B4 | Skallen med to indgange | fase 1½ | 1 |
| D1 | Item-statistik (datalag + skrivning fra spil) | fase 3 | 1 |
| D2 | Dashboard: læringstal + "her kæmper barnet" | fase 3 | 1 |
| D3 | Indstillinger: niveau, transskription, dagens mål | fase 3 | 1–2 |
| D4 | Forælderens egne ord | fase 3 | 1 |
 
**Om rækkefølgen 1.4 vs. B-blokken:** de to hænger sammen i B3. Argumentet for **1.4 først** er, at den tvinger os til at kortlægge hele slette-grafen — præcis den viden vi skal bruge, før vi tilføjer auth-brugere til den — og at den lukker et reelt juridisk hul. Argumentet for **B-blokken først** er, at 1.4 så kun skal skrives én gang. Da appen endnu ikke har rigtige brugere, er den juridiske hastegrad lav, men rework-omkostningen ved 1.4-først er også lille (en udvidelse, ikke en omskrivning).
 
**Min anbefaling: 1.4 først**, netop for kortlægningen — og skriv den bevidst med et dokumenteret udvidelsespunkt, så B3 bliver en tilføjelse frem for en omskrivning.
 
**Samlet: B-blokken er ca. 4½ session.** Det er den største sammenhængende sikkerhedsopgave siden Fase 0's mur. Den bør ikke hastes, og der bør ikke bygges nyt indhold oven på den halvfærdige model.
 
---
 
# Hårde krav (uændret gennem hele planen)
 
- **Muren:** aqidah aldrig AI; de hellige kun som lys; Quran-recitation human-only (DB-håndhævet, urørlig).
- RLS fail-closed; `ai_service` nul adgang til persondata/aqidah; role aldrig klient-styret. **Ny tilføjelse: `child`-rollen tildeles udelukkende af access-token-hooket ud fra `profiles.auth_user_id` — aldrig af klienten.**
- Skema-drift tjekkes på live-DB FØR migrationer (UNION ALL-mønstret med `::text`). `pgcrypto` = `extensions.`-prefix.
- Idempotente migrationer; mur-stil regressionstests (`DO $$`, rollback-markør, 0 rækker efterladt).
- Edge functions committes til repoet efter enhver deploy-ændring.
- Ingen eksterne links/køb i børnetilstand. Dataminimering overalt — også i `profile_item_stats` og `pin_attempts`.
- Demo (simuleret backend) → ejer tester i telefonens rigtige browser → godkendelse → port → grøn build → commit → push med token indsat i chatten.
- `docs/handoff.md` i repoet holdes i sync ved hver milepæl.
- Kirurgiske ændringer, fuld kørbar kode, ingen skitser. Svar på dansk. Ét skridt ad gangen. Spørgsmål som klikbare valgmuligheder.
 
