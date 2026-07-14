-- ============================================================================
-- fase1_tegn_bogstavet_lesson — seed af lesson-række til Tegn Bogstavet
-- ============================================================================
-- Andet kernespil: tracing (barnet maler lys ind i bogstavet). XP/streak
-- gemmes i progress via denne række. Bogstavernes Dal, AI-tilladt —
-- ingen aqidah-berøring. Idempotent.
-- ============================================================================

insert into lessons (world, order_index, title_da, title_ar, content_ids, is_published)
select 'bogstavernes_dal', 2, 'Tegn Bogstavet', 'اُرْسُم الحَرْف', '{}', true
where not exists (
  select 1 from lessons
  where world = 'bogstavernes_dal' and title_da = 'Tegn Bogstavet'
);
