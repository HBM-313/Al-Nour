-- I2: Billed-infrastruktur (plan-platformsmodning.md §3.1)
--
-- Anvendt på live-DB 2026-07-26 via MCP apply_migration som
-- `20260726_images_storage_bucket`. Denne fil er repoets kopi.
--
-- Samme mønster som 'audio'-bucket'en (2026-07-17): public bucket, ingen
-- storage.objects-policies. Skrivning sker via service_role (ejer/Claude via
-- MCP eller dashboard, ligesom generate-audio bruger service_role-nøglen) --
-- ikke via en klient-session, så der er intet behov for INSERT/UPDATE-policies
-- på storage.objects. Bygges et selvbetjent admin-upload-UI senere, er det en
-- bevidst fremtidig udvidelse -- ikke en glemt del af denne migration.
--
-- Strammere end audio-bucket'en (defense in depth, ingen funktionel grund til
-- at være lige så åben):
--   * eksplicit mime-whitelist UDEN svg -- SVG kan bære script og skal ikke
--     kunne uploades som "billede"
--   * 3 MB loft pr. fil -- rigeligt til flade/ikon-illustrationer, forhindrer
--     et fejl-upload i at spise storage-kvote
--
-- `media`-tabellen krævede INGEN ændring: media_type_check tillader allerede
-- 'image' og 'illustration' (verificeret mod live pg_constraint før migration).
--
-- Policy-drift verificeret før migration:
--   media_ai_service_write  -> INSERT for ai_service, kun når
--                              generated_by='ai' AND is_recitation=false.
--                              Uafhængig af `type`, altså ingen ny utilsigtet
--                              skrivevej åbnet af at billeder nu tages i brug.
--   media_staff_write       -> INSERT for admin/editor (vejen for menneske-
--                              uploadede/kuraterede billeder).
--
-- HUSK ved upload (upsert-cache-fælden fra generate-audio): filnavne SKAL
-- indeholde tidsstempel. Et regenereret billede på samme sti serveres ellers
-- fra browser-/CDN-/PWA-cachen i det uendelige.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'images', 'images', true, 3145728, array['image/png','image/webp','image/jpeg']
where not exists (select 1 from storage.buckets where id = 'images');
