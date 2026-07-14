-- ============================================================================
-- fase1_letters_vocabulary — deployeret 2026-07-14 mod ifwlbfuzkuidfzqsvnjz
-- ============================================================================
-- Verificeret efter deploy (alle bestået):
--   28 bogstaver, 54 ord, 0 ord uden startbogstav-kobling
--   former korrekte for forbindere (ب: ب|بـ|ـبـ|ـب) og ikke-forbindere (ا: ا|ا|ـا|ـا)
--   LYD_REGEL: AI-lyd på bogstav → AFVIST; ukendt medie → AFVIST (fail-closed);
--              menneskelig lyd → ACCEPTERET (testene rullet tilbage)
--   ai_service: select/insert på begge tabeller = false
--   updated_at-triggere: 6 (drift-fix, manglede helt i live)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Drift-fix: updated_at auto-touch (fra 0001)
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_accounts_updated_at before update on accounts
  for each row execute function set_updated_at();
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger trg_content_updated_at before update on content
  for each row execute function set_updated_at();
create trigger trg_lessons_updated_at before update on lessons
  for each row execute function set_updated_at();
create trigger trg_progress_updated_at before update on progress
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- letters
-- ----------------------------------------------------------------------------
create table letters (
  id uuid primary key default gen_random_uuid(),
  position int not null unique check (position between 1 and 28),
  letter text not null unique,           -- grundtegnet (isoleret form)
  name_ar text not null,                 -- fx ألف
  name_da text not null,                 -- fx Alif
  sound_hint_da text not null,           -- dansk udtale-hjælp
  is_connector boolean not null,         -- forbinder bogstavet fremad (venstre)?

  -- De fire former genereres af tatweel-metoden og kan ikke drifte:
  form_isolated text generated always as (letter) stored,
  form_initial  text generated always as (case when is_connector then letter || 'ـ' else letter end) stored,
  form_medial   text generated always as ('ـ' || letter || case when is_connector then 'ـ' else '' end) stored,
  form_final    text generated always as ('ـ' || letter) stored,

  audio_media_id uuid references media(id),  -- SKAL være human (trigger)
  level int not null default 1 check (level between 1 and 4),
  created_at timestamptz not null default now()
);

comment on table letters is
  'De 28 arabiske bogstaver. Former genereres via tatweel af letter+is_connector. '
  'Lyd er kerne-fusha og SKAL være menneskeligt optaget — se trg_letters_audio_human.';

-- ----------------------------------------------------------------------------
-- vocabulary
-- ----------------------------------------------------------------------------
create table vocabulary (
  id uuid primary key default gen_random_uuid(),
  word_ar text not null unique,          -- vokaliseret (med harakat)
  transliteration text not null,         -- barnevenlig, aftrappes pr. niveau i UI
  word_da text not null,
  category text not null check (category in
    ('familie','tal','farver','dyr','mad','krop','hjem','natur','hilsner')),
  register text not null default 'fusha' check (register in ('fusha','everyday')),
  first_letter_id uuid references letters(id),
  level int not null default 1 check (level between 1 and 4),
  image_media_id uuid references media(id),
  audio_media_id uuid references media(id), -- AI tilladt (hverdagsordforråd)
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table vocabulary is
  'Ordforråd til Bogstavernes Dal. register farvekoder fusha vs hverdagsarabisk. '
  'first_letter_id kobler ordet til dets startbogstav (bruges af Lyt & Find).';

create index idx_vocabulary_letter on vocabulary(first_letter_id);
create index idx_vocabulary_level on vocabulary(level);
create index idx_vocabulary_category on vocabulary(category);

create trigger trg_vocabulary_updated_at before update on vocabulary
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Lyd-reglen: bogstav-lyd skal være menneskelig
-- ----------------------------------------------------------------------------
create or replace function enforce_letter_audio_human()
returns trigger
language plpgsql
security definer            -- skal altid kunne læse media; checker IKKE current_user
set search_path = public
as $$
declare
  g media_generated_by;
begin
  if new.audio_media_id is not null then
    select generated_by into g from media where id = new.audio_media_id;
    -- Fail-closed: NULL (medie ikke fundet) afvises også.
    if g is distinct from 'human' then
      raise exception 'LYD_REGEL: bogstav-lyd er kerne-fusha og skal være menneskeligt optaget (media.generated_by=human). Fundet: %',
        coalesce(g::text, 'medie ikke fundet');
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_letters_audio_human before insert or update on letters
  for each row execute function enforce_letter_audio_human();

-- ----------------------------------------------------------------------------
-- RLS + rettigheder
-- ----------------------------------------------------------------------------
alter table letters enable row level security;
alter table vocabulary enable row level security;

-- Læring er offentlig læsedata (ingen persondata):
create policy letters_read_all on letters
  for select to anon, authenticated using (true);

create policy vocabulary_read_published on vocabulary
  for select to anon, authenticated using (is_published = true);

-- Kun admin/editor må skrive (fail-closed via coalesce, samme mønster som muren):
create policy letters_write_admin_editor on letters
  for all to authenticated
  using (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'))
  with check (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'));

create policy vocabulary_read_admin_editor on vocabulary
  for select to authenticated
  using (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'));

create policy vocabulary_write_admin_editor on vocabulary
  for all to authenticated
  using (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'))
  with check (coalesce(current_setting('request.jwt.claims', true)::json->>'user_role','') in ('admin','editor'));

grant select on letters, vocabulary to anon, authenticated;
grant insert, update, delete on letters, vocabulary to authenticated;

-- ai_service: ingen adgang overhovedet til kurrikulum-tabellerne.
revoke all on letters from ai_service;
revoke all on vocabulary from ai_service;

-- ----------------------------------------------------------------------------
-- Seed: de 28 bogstaver (hija'i-rækkefølge)
-- ----------------------------------------------------------------------------
insert into letters (position, letter, name_ar, name_da, sound_hint_da, is_connector) values
  ( 1, 'ا', 'ألف',  'Alif',  'langt a, som i ''far''',                                    false),
  ( 2, 'ب', 'باء',  'Ba',    'b som i ''bil''',                                           true),
  ( 3, 'ت', 'تاء',  'Ta',    't som i ''to''',                                            true),
  ( 4, 'ث', 'ثاء',  'Tha',   'blødt th, som i engelsk ''think''',                         true),
  ( 5, 'ج', 'جيم',  'Jim',   'dj-lyd, som j i engelsk ''jam''',                           true),
  ( 6, 'ح', 'حاء',  'Haa',   'pustet h, dybt fra halsen',                                 true),
  ( 7, 'خ', 'خاء',  'Kha',   'som ch i tysk ''Bach''',                                    true),
  ( 8, 'د', 'دال',  'Dal',   'd som i ''dag''',                                           false),
  ( 9, 'ذ', 'ذال',  'Dhal',  'blødt dh, som th i engelsk ''this''',                       false),
  (10, 'ر', 'راء',  'Ra',    'rullende r med tungespidsen',                               false),
  (11, 'ز', 'زاي',  'Zay',   'stemt s, som z i engelsk ''zoo''',                          false),
  (12, 'س', 'سين',  'Sin',   's som i ''sol''',                                           true),
  (13, 'ش', 'شين',  'Shin',  'sj-lyd, som i ''sjov''',                                    true),
  (14, 'ص', 'صاد',  'Sad',   'mørkt, tykt s',                                             true),
  (15, 'ض', 'ضاد',  'Dad',   'mørkt, tykt d — arabisk kaldes ''Dad-sproget''',            true),
  (16, 'ط', 'طاء',  'Taa',   'mørkt, tykt t',                                             true),
  (17, 'ظ', 'ظاء',  'Zaa',   'mørkt, tykt dh',                                            true),
  (18, 'ع', 'عين',  'Ayn',   'dyb lyd fra svælget — findes ikke på dansk',                true),
  (19, 'غ', 'غين',  'Ghayn', 'som dansk r i ''rød'', bagest i munden',                    true),
  (20, 'ف', 'فاء',  'Fa',    'f som i ''fisk''',                                          true),
  (21, 'ق', 'قاف',  'Qaf',   'dybt k, helt bagest i munden',                              true),
  (22, 'ك', 'كاف',  'Kaf',   'k som i ''kat''',                                           true),
  (23, 'ل', 'لام',  'Lam',   'l som i ''lys''',                                           true),
  (24, 'م', 'ميم',  'Mim',   'm som i ''mor''',                                           true),
  (25, 'ن', 'نون',  'Nun',   'n som i ''nat''',                                           true),
  (26, 'ه', 'هاء',  'Ha',    'h som i ''hus''',                                           true),
  (27, 'و', 'واو',  'Waw',   'w som i engelsk ''water''',                                 false),
  (28, 'ي', 'ياء',  'Ya',    'j som i ''ja''',                                            true);

-- ----------------------------------------------------------------------------
-- Seed: de første 54 ord (koblet til startbogstav)
-- ----------------------------------------------------------------------------
insert into vocabulary (word_ar, transliteration, word_da, category, register, level, first_letter_id)
select v.word_ar, v.translit, v.word_da, v.category, 'fusha', v.level, l.id
from (values
  ('أُمّ',      'umm',       'mor',       'familie', 1, 'ا'),
  ('أَب',       'ab',        'far',       'familie', 1, 'ا'),
  ('أَخ',       'akh',       'bror',      'familie', 1, 'ا'),
  ('أُخْت',     'ukht',      'søster',    'familie', 1, 'ا'),
  ('جَدّ',      'jadd',      'bedstefar', 'familie', 1, 'ج'),
  ('جَدَّة',    'jadda',     'bedstemor', 'familie', 1, 'ج'),
  ('وَاحِد',    'waahid',    'en',        'tal', 1, 'و'),
  ('اِثْنَان',  'ithnaan',   'to',        'tal', 1, 'ا'),
  ('ثَلَاثَة',  'thalaatha', 'tre',       'tal', 1, 'ث'),
  ('أَرْبَعَة', 'arba''a',   'fire',      'tal', 1, 'ا'),
  ('خَمْسَة',   'khamsa',    'fem',       'tal', 1, 'خ'),
  ('سِتَّة',    'sitta',     'seks',      'tal', 2, 'س'),
  ('سَبْعَة',   'sab''a',    'syv',       'tal', 2, 'س'),
  ('ثَمَانِيَة','thamaaniya','otte',      'tal', 2, 'ث'),
  ('تِسْعَة',   'tis''a',    'ni',        'tal', 2, 'ت'),
  ('عَشَرَة',   '''ashara',  'ti',        'tal', 2, 'ع'),
  ('أَحْمَر',   'ahmar',     'rød',       'farver', 1, 'ا'),
  ('أَزْرَق',   'azraq',     'blå',       'farver', 1, 'ا'),
  ('أَخْضَر',   'akhdar',    'grøn',      'farver', 1, 'ا'),
  ('أَصْفَر',   'asfar',     'gul',       'farver', 1, 'ا'),
  ('أَبْيَض',   'abyad',     'hvid',      'farver', 2, 'ا'),
  ('أَسْوَد',   'aswad',     'sort',      'farver', 2, 'ا'),
  ('قِطّ',      'qitt',      'kat',       'dyr', 1, 'ق'),
  ('كَلْب',     'kalb',      'hund',      'dyr', 1, 'ك'),
  ('سَمَكَة',   'samaka',    'fisk',      'dyr', 1, 'س'),
  ('أَسَد',     'asad',      'løve',      'dyr', 2, 'ا'),
  ('عُصْفُور',  '''usfuur',  'fugl',      'dyr', 2, 'ع'),
  ('جَمَل',     'jamal',     'kamel',     'dyr', 2, 'ج'),
  ('مَاء',      'maa''',     'vand',      'mad', 1, 'م'),
  ('خُبْز',     'khubz',     'brød',      'mad', 1, 'خ'),
  ('حَلِيب',    'haliib',    'mælk',      'mad', 1, 'ح'),
  ('تُفَّاحَة', 'tuffaaha',  'æble',      'mad', 1, 'ت'),
  ('مَوْز',     'mawz',      'banan',     'mad', 2, 'م'),
  ('تَمْر',     'tamr',      'dadler',    'mad', 2, 'ت'),
  ('يَد',       'yad',       'hånd',      'krop', 1, 'ي'),
  ('عَيْن',     '''ayn',     'øje',       'krop', 1, 'ع'),
  ('فَم',       'fam',       'mund',      'krop', 1, 'ف'),
  ('أَنْف',     'anf',       'næse',      'krop', 2, 'ا'),
  ('قَدَم',     'qadam',     'fod',       'krop', 2, 'ق'),
  ('بَيْت',     'bayt',      'hus',       'hjem', 1, 'ب'),
  ('بَاب',      'baab',      'dør',       'hjem', 1, 'ب'),
  ('كِتَاب',    'kitaab',    'bog',       'hjem', 1, 'ك'),
  ('قَلَم',     'qalam',     'blyant',    'hjem', 2, 'ق'),
  ('شَمْس',     'shams',     'sol',       'natur', 1, 'ش'),
  ('قَمَر',     'qamar',     'måne',      'natur', 1, 'ق'),
  ('نَجْمَة',   'najma',     'stjerne',   'natur', 1, 'ن'),
  ('نُور',      'nuur',      'lys',       'natur', 1, 'ن'),
  ('بَحْر',     'bahr',      'hav',       'natur', 2, 'ب'),
  ('شَجَرَة',   'shajara',   'træ',       'natur', 2, 'ش'),
  ('وَرْدَة',   'warda',     'blomst',    'natur', 2, 'و'),
  ('سَلَام',    'salaam',    'fred / hej','hilsner', 1, 'س'),
  ('شُكْرًا',   'shukran',   'tak',       'hilsner', 1, 'ش'),
  ('نَعَم',     'na''am',    'ja',        'hilsner', 1, 'ن'),
  ('لَا',       'laa',       'nej',       'hilsner', 1, 'ل')
) as v(word_ar, translit, word_da, category, level, first_letter)
join letters l on l.letter = v.first_letter;
