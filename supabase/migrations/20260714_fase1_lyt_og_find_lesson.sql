-- ============================================================================
-- fase1_lyt_og_find_lesson — seed af lesson-række til Lyt & Find-spillet
-- ============================================================================
-- Spillet gemmer XP/streak i progress, som kræver en lesson_id
-- (UNIQUE(profile_id, lesson_id)). Denne række er spillets anker i
-- Bogstavernes Dal. Rent AI-tilladt verden — ingen aqidah-berøring.
-- Idempotent: kan køres igen uden dubletter.
-- ============================================================================

insert into lessons (world, order_index, title_da, title_ar, content_ids, is_published)
select 'bogstavernes_dal', 1, 'Lyt & Find', 'اِسْمَع وَجِد', '{}', true
where not exists (
  select 1 from lessons
  where world = 'bogstavernes_dal' and title_da = 'Lyt & Find'
);
