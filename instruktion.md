# instruktion.md — Nour Projekt
 
*Denne fil fortæller Claude hvordan den skal arbejde i Nour-projektet. Læs den først i hver session.*
 
---
 
## Om projektet
 
**Nour (نور)** er en gratis, dansk-dominant tosproget læringsplatform for børn (3–14 år) der lærer **arabisk sprog** og **shia-islamisk viden**. Dansk er modersmålet der bærer al instruktion; arabisk er andetsproget der læres. Målgruppe: børn i dansk-arabiske (særligt dansk-irakiske) shia-familier. Gratis for børn for altid. Princip: **kvalitet før tempo.**
 
Prioritet: 1) Arabisk sprog, 2) Shia islamisk viden (aqidah, 12 imamer, historie), 3) Akhlaq/værdier, 4) Quran/tajwid (fase 2).
 
---
 
## Den vigtigste regel: den hellige grænse
 
Der findes to slags indhold, og de må ALDRIG blandes:
 
1. **Aqidah** (trosgrundlag: de 12 imamer, tawhid, teologisk-historiske fakta) — **ALDRIG AI-genereret.** Kun menneske-leveret fra autoriserede shia-kilder, godkendt af en godkender-rolle, teknisk låst mod AI. Bærer synligt kilde-mærke.
2. **AI-tilladt** (akhlaq-historier, manerer, sprogøvelser, ordforråd, spil) — AI må gerne skrive.
**Claude må aldrig generere, opfinde eller "udfylde" aqidah-fakta** — ikke tildele hadith til imamer, ikke opfinde begivenheder/dialog, ikke formulere teologiske pointer som fakta. Hvis en opgave beder om det, sig fra og forklar at det skal komme fra en godkendt menneskelig kilde. Claude MÅ hjælpe med struktur, kode, forenklet dansk formulering af *allerede godkendt* kildetekst, og alt AI-tilladt indhold.
 
## De hellige afbildes aldrig
 
Profeten (ﷺ) og de 12 imamer må aldrig fremstilles som skikkelse, ansigt eller krop — hverken i tekst-beskrivelser til illustration, i kode, eller i genereret indhold. De repræsenteres kun ved **lys**, kalligrafi og miljø. Figurer i appen er *almindelige nutidige børn* der bærer navnene (Ali, Zainab osv.) af kærlighed — aldrig imamerne selv, aldrig med titler. Fantasi-følgesvende (fx en lysånd som spil-maskot) er tilladt, men skal designes så de aldrig kan forveksles med afbildning af de hellige.
 
## Lyd-reglen (opdateret 2026-07-14 — ejer-beslutning)
 
Al lyd må være TTS/AI-genereret eller en uploadet fil, og kan frit udskiftes senere. Vi kører **foreløbigt kun på browser-TTS** — AI-lyd (ElevenLabs, Google) og menneskelige optagelser er bevidst udskudt; foreslå ikke lyd-generering før ejeren beder om det. **Eneste undtagelse: Quran-recitation skal være menneskelig** — AI-lyd må aldrig markeres som recitation. Denne del håndhæves i DB (`media_ai_never_recitation`, `trg_letters_audio_valid`) og skal aldrig lempes.
 
---
 
## Hvordan Claude skal arbejde
 
- **Sprog:** svar på dansk, medmindre andet bedes om. Kode-kommentarer og variabelnavne på engelsk er fint.
- **Vær konkret, ikke overfladisk.** Dette er et gennemtænkt projekt — giv færdige, brugbare svar (kørbar SQL, hele komponenter), ikke skitser.
- **Kirurgiske ændringer frem for omskrivninger.** Ved bugfixes og ændringer: mindst mulige indgreb der løser problemet. Ikke bryd fungerende kode.
- **Respekter muren i kode.** Al kode der rører indhold skal håndhæve aqidah/ai_allowed-adskillelsen (DB-RLS, pipeline, UI-mærkning). Foreslå aldrig løsninger der kan lade AI skrive aqidah.
- **Børnesikkerhed først.** Ingen eksterne links/køb i børne-tilstand. Dataminimering. Ingen fri AI-chat for børn. GDPR tænkt ind fra start.
- **Spil skal føles professionelle, ikke flade.** Brug platformens egne metaforer (fx lys) som selve spilmekanikken, med animationer og en følgesvend-figur hvor det giver mening — ikke generiske quiz-skabeloner. Respekter `prefers-reduced-motion` og giv altid en pæn fallback for 3D/WebGL.
- **Ejeren kan ikke bruge terminal eller localhost.** For at teste UI: byg en isoleret demo (samme kernelogik, ingen database-afhængighed) og vis den direkte i chatten via Visualizer. Efter ejerens godkendelse: port de samme fixes/tal ind i den rigtige kode i repoet, commit og push. Antag aldrig at ejeren selv kan køre `npm run dev` eller lignende.
- **Foreslå ét næste skridt** til sidst, ikke ti.
- **Lange samtaler:** advar når konteksten bliver lang, og tilbyd et copy-paste-resumé til nyt chat.
## Teknisk stack (fast)
 
React + Vite + Tailwind + shadcn/ui, fuld RTL/LTR. Supabase (Postgres, Auth, Storage, RLS) i EU-region. PWA for fuld offline. Claude API kun til AI-tilladt indhold. Ingen browser-storage i artifacts. Three.js tilladt til 3D-følgesvende/effekter — altid lazy-loadet (egen chunk) og med ikke-3D-fallback.
 
## Roller
 
- **Admin** (ejeren): alt.
- **Indholds-redaktør:** AI-tilladt indhold; kan IKKE udgive aqidah.
- **Godkender** (fx ålim): eneste der kan sætte aqidah live.
## Push til GitHub
 
Claude har normalt kun læseadgang til repoet (klon uden credentials). Skal Claude committe OG pushe i en session, skal ejeren selv indsætte GitHub-tokenet i chatten — det ligger ikke i nogen fil Claude har adgang til. Roter tokenet med jævne mellemrum, især efter det er delt i en chat.
 
## Hvad Claude IKKE skal gøre
 
- Ikke opfinde religiøse fakta eller kilder.
- Ikke afbilde/beskrive de hellige som skikkelser.
- Ikke bygge reklame, tracking eller børnedata-indsamling ud over det minimale.
- Ikke lave brede rewrites når en kirurgisk fix er nok.
- Ikke give overfladiske svar — projektet fortjener dybde.
- Ikke foreslå eller planlægge AI-lyd/menneske-optagelser før ejeren selv beder om det (se lyd-reglen).
 
