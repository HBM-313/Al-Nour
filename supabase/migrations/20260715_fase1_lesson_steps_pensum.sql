-- ============================================================================
-- fase1_lesson_steps_pensum — lektions-strukturen (ejer-godkendt plan)
-- ============================================================================
-- Kortets lanterner er LEKTIONER, ikke spil: 7 lektioner à 4 bogstaver i
-- hija'i-orden, hver bygget af trin der blander de tre spil-mekanikker med
-- stigende sværhedsgrad. En session kan vare 5–30 min: progress gemmes pr.
-- trin, man kan altid stoppe og genoptage ("fortsæt hvor du slap").
--
-- Aldersskind via skins-kolonnen: soft spiller de blide trin, mid får
-- form-trinnet med, teen får alle seks. Ændrer HVORDAN, aldrig HVAD.
--
-- Frit valg, ingen låsning (ejer-beslutning): kortet ANBEFALER næste
-- lektion, men alle kan åbnes.
--
-- MUREN: ren kurrikulum-data i Bogstavernes Dal (AI-tilladt verden).
-- Samme fail-closed RLS-mønster som letters/vocabulary. ai_service: nul
-- adgang. Ingen aqidah-berøring.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. lesson_steps
-- ----------------------------------------------------------------------------

create table if not exists lesson_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  order_index int not null,
  game_type text not null
    check (game_type in ('lyt_og_find', 'tegn_bogstavet', 'match_par')),
  -- Vises i pusterummet mellem trin ("Mød de nye bogstaver")
  title_da text not null,
  -- Lektionens NYE bogstaver (letters.position, 1-28)
  letter_positions int[] not null default '{}',
  -- true = medtag også bogstaver/ord fra tidligere lektioner (repetition)
  include_review boolean not null default false,
  difficulty text not null default 'mixed'
    check (difficulty in ('easy', 'mixed', 'hard')),
  -- Antal spørgsmål/bogstaver/par i trinnet (fortolkes af spiltypen)
  question_count int not null default 6
    check (question_count between 2 and 20),
  -- Hvilke aldersskind trinnet gælder for
  skins text[] not null default '{soft,mid,teen}'
    check (skins <@ array['soft', 'mid', 'teen']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, order_index)
);

comment on table lesson_steps is
  'Trin i en lektion: sekvens af spil-runder med stigende sværhedsgrad. '
  'Kurrikulum-data (Bogstavernes Dal, AI-tilladt) — aldrig aqidah.';

create trigger trg_lesson_steps_updated
  before update on lesson_steps
  for each row execute function set_updated_at();

create index if not exists idx_lesson_steps_lesson
  on lesson_steps (lesson_id, order_index);

-- ----------------------------------------------------------------------------
-- 2. RLS (samme fail-closed mønster som letters/vocabulary)
-- ----------------------------------------------------------------------------

alter table lesson_steps enable row level security;

-- Kurrikulum er offentlig læsedata (ingen persondata):
create policy lesson_steps_read_all on lesson_steps
  for select to anon, authenticated using (true);

-- Kun admin/editor må skrive (fail-closed via coalesce):
create policy lesson_steps_write_admin_editor on lesson_steps
  for all to authenticated
  using (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'))
  with check (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'));

grant select on lesson_steps to anon, authenticated;
grant insert, update, delete on lesson_steps to authenticated;

-- ai_service: ingen adgang overhovedet.
revoke all on lesson_steps from ai_service;

-- ----------------------------------------------------------------------------
-- 3. progress: gem-undervejs (næste trin at spille, 0-baseret)
-- ----------------------------------------------------------------------------

alter table progress add column if not exists current_step int not null default 0;

comment on column progress.current_step is
  'Næste trin (0-baseret index i lektionens lesson_steps) — muliggør '
  '"fortsæt hvor du slap". status=completed når alle trin for skindet er kørt.';

-- ----------------------------------------------------------------------------
-- 4. De tre gamle spil-lektioner: afpubliceres og flyttes af vejen
--    (bevares pga. eksisterende progress-rækker; slettes ikke)
-- ----------------------------------------------------------------------------

update lessons
set is_published = false, order_index = order_index + 100
where world = 'bogstavernes_dal'
  and title_da in ('Lyt & Find', 'Tegn Bogstavet', 'Match-par')
  and order_index < 100;

-- ----------------------------------------------------------------------------
-- 5. De 7 lektioner (hija'i-grupper à 4) — titler udledes af letters-
--    tabellen, så pensum aldrig kan drifte fra bogstavdata. Idempotent.
-- ----------------------------------------------------------------------------

insert into lessons (world, order_index, title_da, title_ar, content_ids, is_published)
select
  'bogstavernes_dal',
  g.oi,
  (select string_agg(name_da, ' · ' order by position)
     from letters where position between (g.oi - 1) * 4 + 1 and g.oi * 4),
  (select string_agg(letter, ' ' order by position)
     from letters where position between (g.oi - 1) * 4 + 1 and g.oi * 4),
  '{}',
  true
from generate_series(1, 7) as g(oi)
where not exists (
  select 1 from lessons
  where world = 'bogstavernes_dal' and order_index = g.oi
);

-- ----------------------------------------------------------------------------
-- 6. Pensum-skabelon: 6 trin pr. lektion (soft kører 4, mid 5, teen 6)
-- ----------------------------------------------------------------------------

with dal_lessons as (
  select id, order_index
  from lessons
  where world = 'bogstavernes_dal'
    and order_index between 1 and 7
),
tmpl(step_index, game_type, title_da, include_review, difficulty, question_count, skins) as (
  values
    (1, 'lyt_og_find',    'Mød de nye bogstaver',       false, 'easy',  6, array['soft','mid','teen']),
    (2, 'tegn_bogstavet', 'Mal lys i bogstaverne',      false, 'easy',  4, array['soft','mid','teen']),
    (3, 'lyt_og_find',    'Bland med dem du kan',       true,  'mixed', 8, array['soft','mid','teen']),
    (4, 'match_par',      'Par ord med dine bogstaver', true,  'mixed', 6, array['soft','mid','teen']),
    (5, 'lyt_og_find',    'Bogstavets former',          false, 'hard',  6, array['mid','teen']),
    (6, 'tegn_bogstavet', 'Skriv alle formerne',        false, 'hard',  4, array['teen'])
)
insert into lesson_steps
  (lesson_id, order_index, game_type, title_da, letter_positions,
   include_review, difficulty, question_count, skins)
select
  l.id,
  t.step_index,
  t.game_type,
  t.title_da,
  array[(l.order_index - 1) * 4 + 1, (l.order_index - 1) * 4 + 2,
        (l.order_index - 1) * 4 + 3, (l.order_index - 1) * 4 + 4],
  t.include_review,
  t.difficulty,
  t.question_count,
  t.skins
from dal_lessons l
cross join tmpl t
where not exists (
  select 1 from lesson_steps s
  where s.lesson_id = l.id and s.order_index = t.step_index
);
