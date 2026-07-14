# Migrationer

- `0001–0003`: reference-design fra planlægningen.
- `20260713193405_fase0_aqidah_mur_haerdet.sql`: deployeret hærdning af muren.
- `20260713_content_udvid_mod_0001.sql`: deployeret 2026-07-13 — lukkede
  skema-driften ved at udvide live `content` mod 0001-designet (title_da/ar,
  sacred_representation, tre aldersvarianter, declarative aqidah-constraints,
  indexes). Verificeret med testserie (se filens header).

**Status:** live `content` matcher nu 0001-designet. Bevidste, blivende
afvigelser fra 0001 andre steder: accounts.id = auth.uid() (ingen separat
auth_user_id), profiles.avatar er text (ikke FK), characters har egen
sacred_representation-kolonne med check <> 'light', media.type inkluderer
'illustration'. Disse betragtes som forbedringer og skal IKKE "rettes" mod 0001.


## Lyd-reglen lempet (ejer-beslutning 2026-07-14)

`20260714_fase1_lydregel_lempet.sql` erstatter `trg_letters_audio_human` med
`trg_letters_audio_valid`. Ny regel: **al lyd må være TTS/AI eller uploadet
fil — kun Quran-recitation skal være menneskelig** (`media_ai_never_recitation`
består). Bogstavlyd må aldrig være recitation-markeret, og ukendte medier
afvises stadig fail-closed. Dette er en bevidst lempelse, ikke drift — skal
IKKE rulles tilbage. Ældre kommentarer om "kerne-fusha = human-only" i
tidligere migrationsfiler er historiske.
