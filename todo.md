# todo.md — Nour: Næste session
 
*Læg denne i projektmappen sammen med den opdaterede handoff.md.*
 
## 1. FØRST: Kør lyd-generatoren (ejer-handling, ~10 min)
 
Alt er bygget og deployeret — der mangler kun selve kørslen:
 
1. Supabase-dashboard → **Edge Functions → generate-audio → Test**
2. Metode **POST** · Body `{"limit": 20}`
3. Headers: venstre felt `Authorization` · højre felt `Bearer <service_role-nøglen>`
   (nøglen: Project Settings → API → service_role → Reveal)
4. Kør og læs JSON-svaret. **Gentag til `remaining: 0`** — 164 klip i alt
   (28 bogstaver + 54 ord × 2 stemmer: Habibah ♀ / Ahmed ♂), altså ~9 kørsler.
**Kendt risiko:** Første kørsel med Rachel-stemmen fejlede med `TTS 402:
paid_plan_required` (library voices kræver betalt plan via API på gratis-
niveau). Habibah/Ahmed er nu standard — MEN hvis de også er hentet fra
Voice Library, kan 402 komme igen. I så fald, sig det til Claude i chatten:
løsningen er enten (a) ElevenLabs Starter-plan (~$5/md), eller (b) skift
til premade-stemmer via Secrets `TTS_VOICE_ID_FEMALE` / `TTS_VOICE_ID_MALE`
(ingen ny deploy nødvendig).
 
**Andre kendte fejl-svar:** `401` = forkert/manglende nøgle i Headers.
`JWT issued at future` = vent 1-2 min og prøv igen (clock-skew efter
nøgle-rotation).
 
## 2. DEREFTER: Verificér lyden i appen
 
- Åbn appen → start Lektion 1 → Lyt & Find-trinnet skal afspille **fil-lyd**
  (samme stemme på alle enheder — også enheder uden arabisk browser-stemme).
- Skift **Oplæser-stemme** på forsiden (Habibah ♀ / Ahmed ♂) → start et NYT
  spil → stemmen skal skifte (valget læses ved spilstart, ikke midt i).
- Meld resultat i chatten (virker/virker ikke + evt. failures fra JSON).
## 3. SÅ: Vælg næste milepæl (én ad gangen)
 
- **A. Profiler/auth** (anbefalet næste fundament-brik): billede-pinkode til
  børn, forældresamtykke-flow, forældre-dashboard-skelet. Stemmevalg +
  fremskridt flytter fra localStorage til profilen (koden er forberedt).
- **B. Ordforråds-værkstedet:** admin-formular til nye ord + AI-forslag som
  kladder (aldrig auto-publicering — muren gælder).
- **C. Polering af Fase 1:** flere ord pr. kategori, illustrationsstil-
  beslutning, evt. lyd-finpudsning.
## Husk (sikkerhed)
 
- ElevenLabs-nøglen har været delt i en chat → generér en ny (kun Text to
  Speech-adgang), læg i Secrets som `TTS_API_KEY`, slet den gamle.
- GitHub-token roteres jævnligt; indsættes kun i chat når en session skal pushe.
- INGEN nøgler i filer eller repo — nogensinde.
 
