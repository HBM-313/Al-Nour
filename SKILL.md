# SKILL.md — Nour: Dansk/arabisk shia-børnelæring
 
## Hvornår denne skill bruges
 
Brug denne når opgaven rører **Nour**-platformen: dansk/arabisk børnelæring, shia-islamisk indhold til børn, arabisk sprogpædagogik, aqidah/AI-indholdsadskillelse, RTL/LTR-tosproget UI, eller figur/indholds-design med de hellige repræsenteret som lys. Denne skill indeholder domæne-viden der er let at få forkert.
 
---
 
## Kerneviden 1: Aqidah vs. AI-tilladt indhold
 
Den vigtigste skelnen i hele domænet.
 
**Aqidah** = trosgrundlag: de 12 imamer, tawhid, imamah, teologisk-historiske fakta om Ahlulbayt. Disse er hellige fakta. AI må ALDRIG være kilden. Selv små fejl (forkert imam til en hændelse, sunni/shia-kilder blandet, opdigtet detalje) er alvorlige og skader troværdigheden. Håndteres via RAG-lignende model: mennesket leverer godkendt kildetekst; AI må højst forenkle sproget af *allerede godkendt* tekst, aldrig tilføje fakta.
 
**AI-tilladt** = akhlaq (værdier/manerer), dagligdags-scenarier, sprogøvelser, ordforråd, spil-tekst. Her er ingen teologiske fakta på spil — kun værdier og sprog — så AI må skrive frit.
 
**Teknisk mur (tre lag, altid alle tre):**
1. Database: RLS + trigger afviser skrivning til aqidah-rækker fra ikke-godkender-roller; AI-service-rolle har ingen skriveret til aqidah.
2. Pipeline: AI-genereringskodesti kan kun sætte `content_type='ai_allowed'` (hardcodet).
3. UI: aqidah viser synligt kilde-verificeret-mærke.
## Kerneviden 2: De hellige som lys, aldrig som skikkelse
 
Følg normen (bredt udbredt i shia-tradition) om ikke at afbilde Profeten (ﷺ) og de 12 imamer. I ALT — tekst, kode, billed-prompts, genereret indhold:
- Aldrig ansigt, krop eller skikkelse for de hellige.
- Repræsenter dem ved lys (glød, stjerne, oplyst plads), kalligrafi med ærbødighed (ﷺ / عليه السلام), og illustreret miljø (ørken, Medina, moské).
- Ven-figurer (med ansigt) og hellige (som lys) deler aldrig samme billede.
Figurer i appen er *almindelige nutidige børn* der bærer Ahlulbayts navne af kærlighed — ikke imamerne. Omtales "din ven Ali", aldrig med titler.
 
Navne til figurer/avatarer — drenge: Ali, Hassan, Hussain, Abbas, Mohsen, Sadiq, Baqir, Sajjad, Mohammed, Taqi, Jawad, Kadhim. Piger: Fatima, Zainab, Zahraa, Ruqaya, Khadija, Amina, Narjis, Sakina, Masuma, Samanah. Hvert navn kan have et "mit navn betyder…"-øjeblik.
 
**Følgesvende/væsener der IKKE er de hellige eller ven-figurer** (fx en fantasi-lysånd som spil-følgesvend) er tilladt, men skal bygges så de aldrig kan forveksles med afbildning af de hellige: intet ansigt-med-krop der ligner et menneske, ingen titler, ingen religiøs symbolik der antyder identitet. Ren fantasi-figur af lys/glød er sikker; en stiliseret "engel" eller "helgen"-figur er det ikke.
 
## Kerneviden 3: Dansk-dominant tosproget pædagogik
 
Dansk bærer al instruktion; arabisk vokser gradvist men dansk forbliver dominant.
- Niveau 1: dansk forklarer alt, arabisk som enkeltord + lyd + transskription + billede.
- Niveau 2: korte arabiske fraser, dansk forklarer.
- Niveau 3: arabisk skrift uden transskription på kendte ord.
- Niveau 4: hele små arabiske sætninger; dansk til nyt.
Transskription aftrappes automatisk pr. niveau, kan slås til igen. Skel fusha (til Quran/religion) fra hverdagsarabisk med farvekode.
## Kerneviden 4: Aldersmodel — én verden, tre skind
 
Ét univers, tre præsentationslag bestemt af fødselsår (ændrer *hvordan*, ikke *hvad*):
- 3–6: rent lyd/ikon, ingen læsekrav, kæmpe knapper, 60–90 sek, næsten ingen "forkert".
- 7–10: læsning (dansk først), 2–4 min, quiz med venlig feedback.
- 11–14: opstrammet æstetik (ikke barnlig), historisk dybde, sværere sprog.
Data: `content` har min_age/max_age + evt. tre tekstvarianter (simpel/mellem/dyb).
## Kerneviden 5: RTL/LTR
 
Arabisk = RTL, dansk = LTR, mødes på samme skærm. Håndter `dir`-attribut pr. tekstblok, ikke globalt. Test blandet-retning-layouts (dansk sætning med arabisk ord indlejret). Kirurgiske fixes frem for globale layout-omskrivninger.
 
---
 
## Universet (til konsistens)
 
- **Nour-landet (بلاد النور):** kort man rejser i; lys vokser med barnets fremskridt.
- **Bogstavernes Dal (وادي الحروف):** sprog, AI-tilladt, startområde.
- **Historiernes Bjerge (جبال الحكايات):** ahlulbayt/aqidah, kilde-verificeret, ingen legende figurer, ingen gamificering af troen.
- **Hverdagshaven (بستان الأخلاق):** akhlaq, AI-tilladt, valg-historier.
## Fire kernespil
 
Lyt & Find (lyd→genkendelse) · Tegn Bogstavet (tracing) · Match-par (dansk↔arabisk) · Vælg din vej (akhlaq valg-historie). Historiernes Bjerge har intet spil — kun fortælling + blid "hvad husker du?"-quiz.
 
**Spil-design-princip (tilføjet efter Tegn Bogstavet):** spillene skal føles professionelt lavet, ikke fladt — brug platformens egne metaforer som selve spilmekanikken (fx "lys vokser" bogstaveligt talt som tracing-mekanikken i Tegn Bogstavet), ikke som pynt ovenpå et generisk spil. Animationer og en følgesvend-figur (Nouri, en lysånd) hæver oplevelsen, men skal altid respektere kerneviden 2 (aldrig forveksles med de hellige) og accessibility (`prefers-reduced-motion` respekteret, WebGL-fallback for 3D).
 
## Lyd-regel (opdateret 2026-07-14 — ejer-beslutning)
 
**Al lyd i projektet må være TTS/AI-genereret (fx ElevenLabs, Google) eller en uploadet fil, og kan frit udskiftes senere.** Vi kører foreløbigt udelukkende på browser-TTS som pladsholder — AI-lyd og menneskelige optagelser er bevidst udskudt til en senere fase; planlæg ikke lyd-generering før ejeren beder om det.
 
**Den eneste undtagelse: Quran-recitation skal være menneskelig.** AI-lyd må aldrig markeres som recitation. Dette håndhæves i databasen af `media_ai_never_recitation` (CHECK-constraint: `generated_by='ai'` og `is_recitation=true` kan ikke begge være sande) og af `trg_letters_audio_valid` (afviser recitation-markeret lyd på bogstaver). Denne del af muren er urørlig og skal bestå uændret, også når Quran/tajwid (fase 2) bygges.
 
*Historisk note: tidligere gjaldt "menneskelig optagelse for Quran-recitation og kerne-fusha-udtale" som én samlet regel. Det er ændret — kerne-fusha (bogstaver, ordforråd) må nu godt være TTS/AI. Kun Quran-recitation er stadig human-only.*
 
