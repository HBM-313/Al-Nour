Læs instruktion.md, SKILL.md og handoff.md i projektmappen før du gør noget.
 
Status kort
 
Milepælen "Ordforråds-værkstedet" er AFSLUTTET (2026-07-20, commit 8633bb0, pushet til main):
• Migration 20260720: `vocabulary.suggested_by` ('human'/'ai', default 'human') + mur-trigger `trg_vocab_ai_draft_only` — AI-foreslåede ord kan aldrig INSERTes som udgivne; udgivelse er altid en separat menneskelig UPDATE. Bevist med rollback-markør-regressionstest (0 rækker efterladt).
• `features/vokab-vaerksted/`: ordliste (lanterne-status: udgivet = tændt lys, "Tænd/Sluk lyset"-knap), søg + status/kategori-filtre, nyt ord-formular med live auto-kobling til startbogstav (hamza-normaliseret, samme konvention som seeds), AI-forslags-fane. Portalens nattehimmel/guld-tema (vv-*-klasser).
• ParentAuth: portal-faner "Børn"/"Værkstedet" — kun renderet for admin/editor, men adgangen håndhæves af RLS (`vocabulary_write_admin_editor`), aldrig af UI.
• Edge Function `suggest-vocab` er DEPLOYET (version 1, aktiv): kræver kryptografisk gyldig JWT (auth.getUser) + user_role admin/editor FØR noget Claude-token brændes; SKRIVER ALDRIG i DB — returnerer kun forslag; model claude-sonnet-4-6; hemmelighed `ANTHROPIC_API_KEY` (IKKE sat endnu, se ejer-beslutning nedenfor).
• Dublet-værn i tre lag (ejer-krav): (1) funktionen sender hele det eksisterende ordforråd som undgå-liste i prompten OG efter-filtrerer normaliseret (harakat strippet, hamza foldet, ة→ه) på både word_ar og word_da; (2) klientens engine.ts filtrerer igen (isDuplicateWord); (3) `vocabulary_word_ar_key` UNIQUE som sidste mur. Normaliseringen i engine.ts og funktionen skal holdes synkrone.
• Ejerens rigtige konto er oprettet med role 'admin' (via dashboard+MCP, ejer-vejen); rolle-eskalering fra klient-session re-testet og afvist. Rollefordeling nu: 1 admin, 1 parent (testkonto).
• EJER-BESLUTNING: AI-forslags-delen aktiveres IKKE endnu — `ANTHROPIC_API_KEY` sættes først i Secrets når siden er 100 % færdig. Indtil da viser "Hent forslag" en venlig fejl; alt andet i værkstedet virker fuldt. Foreslå ikke nøgle-opsætning før ejeren selv bringer det op.
• Typecheck + oxlint 0/0 + PWA-build grønne ved push. Ingen udestående migrationer.
 
Denne sessions opgave
 
Start med at stille ejeren dette valg som KLIKBARE VALGMULIGHEDER (antag ikke):
 
Hvilken milepæl nu?
1. Deploy + ejer-test ende-til-ende (anbefalet — igen): Appen er ALDRIG deployet; ejeren har kun testet isolerede demoer og kan ikke køre localhost. Med værkstedet inde er der nu ekstra grund: ejeren kan først bruge værkstedet i virkeligheden når appen er hostet. Sæt gratis hosting op (foreslå fx Cloudflare Pages / Vercel / Netlify med begrundelse; anon-nøglen er offentlig by design og lægges som miljøvariabel i hosting-platformen — ALDRIG committes). Guid derefter fuld ende-til-ende-test på telefonen: login → samtykke → dashboard → værksteds-fanen (admin) → opret barn → dyre-pin → spil en lektion → verificér progress-rækker via MCP.
2. Fase 2-forberedelse: aqidah-workflow i praksis for Historiernes Bjerge (godkender-flow, kilde-mærkning i UI). Claude må KUN strukturere/forenkle ejer-leveret, allerede godkendt kildetekst — aldrig generere aqidah.
3. Polering af Fase 1: flere ord pr. kategori (nu nemt via værkstedet!), illustrationsstil-beslutning, evt. lyd-finpudsning.
Hårde krav (uændret)
 
• Muren: aqidah aldrig AI; de hellige kun som lys; Quran-recitation human-only (DB-håndhævet, urørlig). Værkstedets kladde-mur (trg_vocab_ai_draft_only) og suggest-vocab's "skriver aldrig i DB" er nu også del af muren.
• RLS fail-closed; ai_service nul adgang til persondata; role aldrig klient-styret.
• Skema-drift tjekkes på live-DB FØR migrationer (pg_trigger, pg_policies, pg_constraint, information_schema.columns — UNION ALL-mønstret med ::text). pgcrypto = extensions.-prefix.
• Idempotente migrationer; mur-stil regressionstests (DO $$, rollback-markør, 0 rækker efterladt).
• Ingen eksterne links/køb i børne-tilstand. Dataminimering overalt.
• Demo (SIMULERET backend — CSP blokerer live-kald i artifacts) → ejer tester i telefonens RIGTIGE browser (ikke Claude-appens forhåndsvisning) → godkendelse → port til features/ → typecheck/oxlint/PWA-build grønne → commit → ejeren indsætter GitHub-token i chatten → push. Token bruges kun inline, aldrig i filer/git-config; ejeren styrer selv sin rotationsplan — påmind ikke.
• Kirurgiske ændringer, fuld kørbar kode, ingen skitser. Svar på dansk. Ét konkret skridt ad gangen. Alle spørgsmål som klikbare valgmuligheder.
 
Nyttige tekniske ankre til opgave 1 (hvis valgt)
 
• Build-kommandoer (i app/): npm ci → npx tsc --noEmit → npx oxlint src → npm run build → output i app/dist/ (PWA, service worker genereres).
• Supabase-klienten (app/src/lib/supabase.ts) læser VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fra miljøvariabler og fejler højlydt hvis de mangler — klar til hosting-platformens env-vars.
• Hosting uden terminal hos ejeren: vælg platform med GitHub-integration (auto-deploy fra main), så ejeren kun klikker i et dashboard. Claude skriver evt. SPA-fallback-config og pusher.
• Testdata til ende-til-ende: test-foraelder@nour.test med Ali (pin dyr nr. 1-2-3) og Zainab (dyr nr. 1-2-3-4) — behold under udvikling, slet før lancering. Ejerens egen konto (role admin) bruges til værksteds-fanen.
• Verificér efter test: progress-rækker via MCP + evt. nye vocabulary-kladder oprettet gennem værkstedet.
 
Husk i sessionen
 
• Opdater handoff'ens "Hvor jeg er nu" ved milepælens afslutning og levér ny opstarts-prompt.
• Advar når konteksten bliver lang, og tilbyd copy-paste-resumé til nyt chat.
• Åbne noter: ANTHROPIC_API_KEY sættes først når siden er 100 % færdig (ejer-beslutning 2026-07-20) · illustrationsstil udestår · testkonto slettes før lancering · juridisk gennemsyn af samtykketekst før lancering · check-google-voices + ElevenLabs-secret kan ryddes i Supabase.
 
