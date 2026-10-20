# Nour (نور) — Komplet Platformsplan
 
*Danmarks bedste dansk/arabiske shia-børnelæringsplatform. Gratis for børn. Kvalitet før tempo.*
 
---
 
## 1. Vision
 
En gratis, dansk-dominant tosproget læringsplatform for børn (3–14) med dansk som modersmål og arabisk som andetsprog. Formålet er at lære **arabisk sprog** (højeste prioritet), **shia-islamisk viden** (aqidah, de 12 imamer, historie), og **akhlaq** (værdier og manerer). Dansk bærer al instruktion; arabisk vokser som "krydderi" men dansk forbliver dominant hele vejen. Quran/tajwid er bevidst fase 2.
 
**Prioritetsrækkefølge:** 1) Arabisk sprog, 2) Shia islamisk viden, 3) Akhlaq/værdier, 4) Quran-læsning.
 
---
 
## 2. Den hellige grænse: to typer indhold
 
Det vigtigste princip i hele produktet.
 
- **Aqidah-indhold** (trosgrundlag: de 12 imamer, tawhid, teologisk-historiske fakta): **aldrig AI-genereret.** Kun leveret og godkendt af mennesker fra autoriserede kilder. Teknisk låst mod AI-redigering. Bærer synligt kilde-verificeret-mærke.
- **AI-tilladt indhold** (akhlaq-historier, manerer, sprogøvelser, ordforråd, spil): AI må skrive, forenkle og generere frit. Bærer *ikke* kilde-mærket.
Grænsen håndhæves i tre lag: database (RLS + trigger), pipeline (AI-værktøj kan kun skrive `content_type='ai_allowed'`), og UI (synligt mærke). De to typer kan aldrig blandes ved en fejl.
 
---
 
## 3. Univers: Nour-landet (بلاد النور)
 
Ét sammenhængende "verden/kort"-univers man rejser igennem, delt i tre forbundne regioner. Efterhånden som barnet lærer, strømmer der **mere lys (nour)** ind i landet — grå områder lyser op, haven blomstrer. Barnets indsats afspejles synligt i *deres* verden.
 
- **Bogstavernes Dal (وادي الحروف)** — Sprog-verden. Startområde for alle. Arabiske bogstaver bor som små væsener. AI-tilladt indhold.
- **Historiernes Bjerge (جبال الحكايات)** — Ahlulbayt-verden. Man stiger opad mod fortællinger om Profeten (ﷺ) og de 12 imamer. Alt kilde-verificeret aqidah. Ingen leg med selve troen.
- **Hverdagshaven (بستان الأخلاق)** — Akhlaq-verden. Gode handlinger får ting til at gro. Interaktive valg-historier. AI-tilladt.
---
 
## 4. Aldersmodel: én verden, tre "aldersskind"
 
Ét Nour for alle, men tre præsentationslag bestemt af barnets fødselsår — ændrer *hvordan* indholdet mødes, ikke *hvad* det er.
 
- **3–6 år:** rent lyd- og ikon-drevet, ingen læsekrav, kæmpe knapper, 60–90 sek. opgaver, næsten ingen "forkert". Blødt, rundt, meget farve.
- **7–10 år:** læsning (dansk først) introduceres, 2–4 min. opgaver, quiz med venlig feedback, samling og fremskridt.
- **11–14 år:** opstrammet æstetik (ikke barnlig), roligere farver som valg, historisk dybde, sværere sprog, respektfuld tone.
Data: hvert `content` har `min_age`/`max_age` og evt. tre tekstvarianter (simpel/mellem/dyb); profilen styrer skind og variant.
 
---
 
## 5. Sprogprogression (dansk-dominant)
 
- **Niveau 1:** alt forklares på dansk; arabisk som enkeltord med lyd, transskription, billede.
- **Niveau 2:** korte arabiske fraser; dansk forklarer alt.
- **Niveau 3:** arabisk skrift uden transskription på kendte ord; dansk til nyt.
- **Niveau 4:** hele små arabiske sætninger; dansk til instruktion og nye emner.
Transskription aftrappes automatisk pr. niveau, men kan slås til igen af barn/forælder. Både fusha og hverdagsarabisk, farvekodet.
 
---
 
## 6. Figurer: børn der bærer Ahlulbayts navne
 
**Grundprincip:** figurerne er *almindelige nutidige børn* der HEDDER Ali, Zainab, Hassan, Fatima — af kærlighed til Ahlulbayt. De **er ikke** imamerne. Omtales altid som "din ven Ali", aldrig med titler (Imam, Amir al-Mu'minin).
 
**De hellige afbildes aldrig** som skikkelse, ansigt eller krop. De repræsenteres kun ved **lys**, lysende stjerne, oplyst plads, og smuk kalligrafi med ærbødighed (ﷺ / عليه السلام). Miljøet illustreres; de hellige selv er nærvær af lys. Ven-figurer og hellige deler aldrig samme billede.
 
**Tre lag:**
- **Barnets avatar:** selvvalgt dreng/pige + navn. Drenge: Ali, Hassan, Hussain, Abbas, Mohsen, Sadiq, Baqir, Sajjad, Mohammed, Taqi, Jawad, Kadhim. Piger: Fatima, Zainab, Zahraa, Ruqaya, Khadija, Amina, Narjis, Sakina, Masuma, Samanah. (Eget navn også muligt.)
- **Gennemgående ven-guide:** vælg mellem en pige (fx Zahraa) og en dreng (fx Ali) som fast følgesvend — forklarer, jubler, trøster.
- **Region-venner:** Bogstavernes Dal (Sadiq, Ruqaya); Hverdagshaven (Hassan, Hussain, Zainab); Historiernes Bjerge har bevidst *ingen* legende figurer — kun respektfuld fortæller.
**Spil-følgesvend (fantasi, ikke en af de navngivne venner):** enkelte spil kan have deres egen maskot-figur — fx Nouri, en lille lysånd i Tegn Bogstavet-spillet — der reagerer på barnets fremskridt. Sådanne følgesvende er bevidst *ikke* mennesker og bærer ikke Ahlulbayts navne; de er rene fantasivæsener af lys, så de aldrig kan forveksles med hverken ven-figurerne eller afbildning af de hellige.
 
**Navnets betydning som læring:** hvert navn har et "mit navn betyder…"-øjeblik (Zahraa = den strålende, Sadiq = den sandfærdige), der knytter barnet til arv og sprog på én gang.
 
**Data:** `characters` (name, name_arabic, gender, role, region, name_meaning_da/ar) + hård regel: hellige findes aldrig som tegnet karakter, kun `sacred_representation='light'` i story-indhold.
 
---
 
## 7. Spil: få, gjort rigtigt
 
Fire perfektionerede kernemekanikker, hver med de tre aldersskind. Designprincip: spillene skal føles professionelt lavet — brug platformens egne metaforer (fx lys der vokser) som selve mekanikken frem for pynt ovenpå et generisk spil, med animationer og hvor det giver mening en følgesvend-figur.
 
1. **Lyt & Find** (lyd→genkendelse): Nouri/ven udtaler bogstav/ord; barn trykker rigtigt. Bygger den kritiske lyd-til-skrift-forbindelse. *(Bygget: lyd-kæde medie-fil → browser-TTS, distraktorer via visuelle ligheds-grupper.)*
2. **Tegn Bogstavet** (tracing på canvas): følg formen med fingeren, med retning og lyd. For ældre: bogstavets forskellige former (isoleret/start/midt/slut). *(Bygget: barnet maler bogstaveligt LYS ind i bogstavet — pixel-dæknings-tracing, klippet til glyffen; 3D-lysånd-følgesvend Nouri via Three.js, lazy-loadet med fallback.)*
3. **Match-par** (dansk↔arabisk): vend-og-find / træk-sammen mellem ord, billede, betydning. Ordforråds-motor. Kan genbruge "Switch Master"-refleksfølelse for ældre. Farvekode skiller fusha/hverdag.
4. **Vælg din vej** (valg-historie, kun akhlaq): barnet vælger handling i en situation; historien reagerer. Værdier gennem konsekvens. AI-tilladt, kan vokse uendeligt.
**Historiernes Bjerge har intet "spil"** — kun illustreret fortælling + blid "hvad husker du?"-quiz bagefter. Man leger med sproget, aldrig med aqidah.
 
**Belønning:** primært lys til landet + figuren vokser. Sekundært XP, streaks, badges, samlinger. Ingen konkurrence mellem børn i børnedelen; leaderboards kun i valgfri lærer/klasse-kontekst.
 
---
 
## 8. Tre-bruger-model
 
- **Barn:** billede-pinkode (vælg tre dyr i rækkefølge). Ingen email, ingen tekst-kode. Ser kun spil og fremskridt.
- **Forælder-dashboard:** opretter børneprofiler, følger fremskridt, sætter mål, styrer transskription/sværhedsgrad, tilføjer egne ord/navne. Gratis.
- **Lærer/madrasa:** opretter klasser med join-kode, tildeler lektioner, ser klasse-oversigt. Fremtidigt indtægtspunkt uden at røre børnedelen.
---
 
## 9. Administrator & administrering
 
**Admin-panel i faser** (byg gradvist mod fuldt visuelt CMS):
- Fase A: rediger tekst/billeder, fast struktur.
- Fase B: fuldt visuelt CMS — byg lektioner/historier uden kode.
- Fase C: avanceret — spil-parametre, XP, rækkefølge.
**Roller:**
- **Admin** (dig): fuld adgang, brugerstyring, alt.
- **Indholds-redaktør:** opretter/redigerer AI-tilladt indhold; kan *ikke* udgive aqidah.
- **Godkender** (fx en ålim): den *eneste* rolle der kan sætte aqidah live.
**Udgivelse (simpel til/fra, men med mur):** de fleste indhold har simpel udgivet/ikke-udgivet kontakt. **Undtagelse:** aqidah kan aldrig sættes live af en redaktør — kun en godkender kan vippe kontakten. Simpelt i brug, muren holder.
 
**Admin-dashboard (alt samlet ét sted):** aktive børn, fremskridt, populært indhold, teknisk drift (fejl/oppetid), bruger-feedback og indholds-rapporter.
 
**Medie-bibliotek (fuldt):** upload, erstat og organiser alle billeder/lyd/illustrationer centralt, med genbrug på tværs af lektioner. **Indbygget AI-lyd-generering** for AI-tilladt indhold — se afsnit 10 for den fulde lydstrategi, som er ændret siden tidligere version af denne plan.
 
**i18n:** hele UI'et — inkl. admin — kan skifte sprog og redigeres centralt. Dansk + arabisk fra start, engelsk muligt senere.
 
---
 
## 10. Lyd-strategi (opdateret 2026-07-14 — ejer-beslutning)
 
**Al lyd i projektet må være TTS/AI-genereret (fx ElevenLabs, Google) eller en uploadet fil, og kan frit udskiftes senere uden kodeændring.** Vi kører foreløbigt udelukkende på **browser-TTS** som pladsholder for alt sprogindhold (bogstaver, ordforråd, akhlaq-historier); AI-lyd fra en dedikeret leverandør og menneskelige optagelser er bevidst udskudt til en senere fase, når platformen skal poleres yderligere.
 
**Den eneste undtagelse: Quran-recitation (fase 2) skal være menneskelig.** AI-lyd må aldrig markeres som recitation. Dette er teknisk håndhævet i databasen (`media_ai_never_recitation`-constraint + trigger på bogstav-lyd) og er en urørlig del af muren, uanset hvor meget resten af lydstrategien ændrer sig.
 
Alt lyd caches som filer i Supabase Storage, uanset kilde (TTS-optagelse, AI-genereret eller menneskelig).
 
*Tidligere version af denne plan skelnede mellem "menneskelig optagelse for Quran-recitation og kerne-fusha" vs. "AI-stemme for hverdagsordforråd". Den skelnen er ophævet for alt undtagen Quran — kerne-fusha (bogstaver) må nu også være TTS/AI.*
 
---
 
## 11. Sikkerhed, offline & kvalitet
 
- **Børnesikkerhed:** ingen eksterne links eller køb når et barn er logget ind. Ren, lukket børne-tilstand.
- **Offline (PWA):** fuldt offline efter første download — vigtigt for familier der deler én enhed. Fremskridt synkes ved næste online-adgang.
- **Fejl-fangst efter udgivelse (alle tre):** forældre/lærere kan rapportere fejl; en simpel "noget er galt"-knap ved hvert indhold; intern log så du ser hvad der fejler.
---
 
## 12. Personalisering
 
- Barnets navn + navnets betydning + valgt figur.
- Belønninger: badges, lys-niveau, samlinger.
- Forældre kan tilføje egne ord/navne barnet skal lære.
- **Højtidsfejring:** sær-indhold til Eid, Ashura m.fl. — knytter platformen til det levede shia-år.
---
 
## 13. GDPR & børnedata (kritisk fra start)
 
- **Dataminimering:** barnet giver kun fornavn/kaldenavn + fødselsår. Aldrig fuldt navn, adresse, email.
- **Forældresamtykke** som retsgrundlag; børn opretter aldrig selv konti.
- Ingen tredjeparts-tracking, ingen reklame, ingen adfærds-analytics på børn.
- EU-hosting (Supabase EU-region). Ét-kliks sletning af barnets profil og al data.
- Klar, dansk, letforståelig privatlivspolitik til forældre.
---
 
## 14. Datamodel (Supabase)
 
- `accounts` — voksne: id, email, role (parent/teacher/admin/editor/approver), created_at.
- `profiles` — børn: id, display_name, avatar, birth_year, ui_language (default 'da'), transliteration_enabled, current_level, owner_account_id.
- `content` — al læring: id, world, content_type (aqidah/ai_allowed), is_source_verified, source_reference, is_locked_from_ai, body_da, body_ar, transliteration, audio_url, min_age, max_age, level, is_published, published_by.
- `characters` — figurer: name, name_arabic, gender, role, region, name_meaning_da/ar, sacred_representation.
- `lessons` — id, world, order_index, title_da, title_ar, content_ids[].
- `progress` — profile_id, lesson_id, status, xp, streak_count, last_completed_at.
- `classes` / `class_members` — lærer-funktion.
- `media` — bibliotek: id, type, url, tags, generated_by (human/ai), is_recitation, reusable.
- `content_reports` — fejlrapporter: content_id, reporter_account_id, note, status.
- `letters` — 28 arabiske bogstaver: navn (ar/da), fire former (isoleret/start/midt/slut, genererede kolonner), lyd-hjælp, position, is_connector, audio_media_id.
- `vocabulary` — ordforråd: word_ar/da, transskription, kategori, niveau, register (fusha/everyday), first_letter_id, audio_media_id.
**RLS/mur:** børn ser kun eget data; lærere kun egen klasse; aqidah-rækker skrivebeskyttede for alle andre end godkender/admin; AI-service-rolle har ingen skriveret til aqidah. Bogstav-lyd (`letters.audio_media_id`) må pege på human- eller AI-genereret medie, men aldrig på et recitation-markeret medie (håndhævet af trigger).
 
---
 
## 15. Teknisk stack
 
React + Vite + Tailwind + shadcn/ui med fuld RTL/LTR-håndtering (genbrug MedicinReminder-erfaring). Supabase (Postgres, Auth, Storage, RLS) i EU. PWA for offline. Claude API kun til AI-tilladt indhold. Three.js til 3D-følgesvende/spileffekter, altid lazy-loadet med ikke-3D-fallback. EU-venlig host.
 
---
 
## 16. Finansiering
 
Gratis kerne for alle børn, permanent. Valgfri støtte-betaling (waqf-model) til hosting, lyd og vedligehold. Lærer/skole-plan som muligt senere indtægtspunkt. Aldrig reklamer.
 
---
 
## 17. Faseplan (kvalitet før tempo)
 
- **Fase 0 — Fundament:** datamodel, RLS, den tekniske mur, admin-CMS (Fase A), aqidah-workflow, GDPR-grundlag. *Byg muren før indholdet.* ✅ Deployeret og verificeret.
- **Fase 1 — Bogstavernes Dal (niveau 1–2):** alfabet, første ~50 ord, Lyt & Find, Tegn Bogstavet, XP/streak, PWA-offline. *Datalag + to af fire spil bygget og pushet. Tilbage: Match-par, Vælg din vej, verdenskort/lektions-navigation.*
- **Fase 2 — Historiernes Bjerge + Hverdagshaven:** første godkendte aqidah-fortællinger (lys-symbolik) + AI-akhlaq-historier (Vælg din vej).
- **Fase 3 — Lærer/klasse-funktion + fuldt CMS (Fase B).**
- **Fase 4 — Quran/tajwid** med menneskelig reciter.
- **Fase 5 — Støtte-betaling, højtidsindhold, skalering, avanceret admin (Fase C), AI-lydgenerering/menneskelige optagelser hvis relevant.**
---
 
## Aqidah-workflow (kombination)
 
Admin-CMS med tre input-metoder: (a) manuel indtastning med obligatorisk kildehenvisning; (b) PDF/bog-upload hvor du markerer godkendte passager med automatisk kilde-reference; (c) verificeret ekstern-link. Intet aqidah går live uden godkenders eksplicitte handling. AI må højst foreslå en forenklet dansk formulering af en allerede godkendt kildetekst — aldrig tilføje fakta.
 
