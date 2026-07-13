-- ============================================================================
-- Nour — Fase 0: Grundskema
-- ============================================================================
-- Formål: alle tabeller for platformen. RLS og aqidah-muren ligger i
-- 0002_rls_policies.sql og 0003_aqidah_wall_trigger.sql — læs dem sammen med
-- denne fil, da tabellerne alene ikke håndhæver den hellige grænse.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type account_role as enum ('parent', 'teacher', 'admin', 'editor', 'approver');

create type content_type as enum ('aqidah', 'ai_allowed');

create type content_world as enum (
  'bogstavernes_dal',   -- Sprog
  'historiernes_bjerge', -- Ahlulbayt / aqidah
  'hverdagshaven'        -- Akhlaq
);

create type sacred_representation as enum ('light', 'none');
-- 'light' = indhold refererer til en af de hellige og MÅ KUN repræsentere dem som lys.
-- 'none'  = indhold har ingen hellig reference (fx almindelig sprogøvelse).
-- Der findes bevidst IKKE en værdi som 'figure' eller 'character' — det skal
-- være umuligt at vælge en skikkelse-repræsentation af de hellige i data.

create type character_role as enum ('avatar_option', 'companion', 'region_friend');

create type progress_status as enum ('not_started', 'in_progress', 'completed');

create type media_generated_by as enum ('human', 'ai');

create type report_status as enum ('open', 'reviewed', 'resolved', 'dismissed');

-- ----------------------------------------------------------------------------
-- accounts — voksne brugere (forældre, lærere, admin, redaktør, godkender)
-- ----------------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  role account_role not null default 'parent',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table accounts is 'Voksne brugere. role styrer adgang; kun approver/admin kan udgive aqidah.';

-- ----------------------------------------------------------------------------
-- profiles — børneprofiler
-- ----------------------------------------------------------------------------

create table profiles (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references accounts(id) on delete cascade,
  display_name text not null,               -- fornavn/kaldenavn kun (dataminimering)
  avatar_character_id uuid,                 -- sat via FK nedenfor efter characters findes
  birth_year int not null check (birth_year between 2005 and extract(year from now())::int),
  ui_language text not null default 'da' check (ui_language in ('da', 'ar')),
  transliteration_enabled boolean not null default true,
  current_level int not null default 1 check (current_level between 1 and 4),
  pin_sequence text[] not null default '{}', -- billede-pinkode (3 dyr i rækkefølge), ingen email
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Børneprofiler. Kun fornavn + fødselsår — dataminimering per GDPR-krav.';

-- ----------------------------------------------------------------------------
-- characters — figurer (aldrig de hellige som skikkelse)
-- ----------------------------------------------------------------------------

create table characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_arabic text,
  gender text check (gender in ('boy', 'girl')),
  role character_role not null,
  region content_world,
  name_meaning_da text,
  name_meaning_ar text,
  image_url text,
  created_at timestamptz not null default now()
);

comment on table characters is
  'Almindelige nutidige børn der bærer Ahlulbayts navne af kærlighed. '
  'De 12 imamer/Profeten (ﷺ) må ALDRIG have en række her — de repræsenteres '
  'udelukkende som lys inde i content.sacred_representation, aldrig som karakter.';

-- Nu kan profiles.avatar_character_id få sin FK
alter table profiles
  add constraint profiles_avatar_character_id_fkey
  foreign key (avatar_character_id) references characters(id);

-- ----------------------------------------------------------------------------
-- content — kernetabellen med den hellige grænse
-- ----------------------------------------------------------------------------

create table content (
  id uuid primary key default gen_random_uuid(),
  world content_world not null,
  content_type content_type not null,

  -- Aqidah-specifikke felter (null for ai_allowed)
  is_source_verified boolean not null default false,
  source_reference text,             -- fx bog/side, ålim-navn, dokument-id
  is_locked_from_ai boolean not null default false,

  -- Indhold
  title_da text not null,
  title_ar text,
  body_da text not null,
  body_ar text,
  transliteration text,
  audio_url text,

  sacred_representation sacred_representation not null default 'none',

  -- Aldersmodel
  min_age int not null default 3 check (min_age >= 3),
  max_age int not null default 14 check (max_age <= 14),
  body_da_simple text,   -- 3-6 variant
  body_da_medium text,   -- 7-10 variant
  body_da_deep text,     -- 11-14 variant

  level int check (level between 1 and 4),

  is_published boolean not null default false,
  published_by uuid references accounts(id),
  published_at timestamptz,

  created_by uuid references accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint age_range_valid check (min_age <= max_age),

  -- Aqidah skal altid være kilde-verificeret og låst før den kan udgives.
  -- ai_allowed-indhold kræver ikke kildeverifikation.
  constraint aqidah_requires_source check (
    content_type <> 'aqidah'
    or (source_reference is not null and is_locked_from_ai = true)
  ),

  -- Aqidah kan aldrig udgives uden at være kilde-verificeret.
  constraint aqidah_publish_requires_verification check (
    not (content_type = 'aqidah' and is_published = true and is_source_verified = false)
  ),

  -- Kun Historiernes Bjerge (ahlulbayt) må indeholde aqidah-indhold.
  constraint aqidah_only_in_historiernes_bjerge check (
    content_type <> 'aqidah' or world = 'historiernes_bjerge'
  ),

  -- Hvis noget refererer til en hellig person, skal det repræsenteres som lys.
  -- (Der findes ingen anden gyldig værdi end 'light'/'none' i enum'et, men
  -- dette constraint sikrer aqidah-indhold aktivt SKAL sætte 'light'.)
  constraint aqidah_must_use_light check (
    content_type <> 'aqidah' or sacred_representation = 'light'
  )
);

comment on table content is
  'Al læringsindhold. content_type=aqidah er teologisk trosgrundlag: aldrig '
  'AI-genereret, kun menneske-leveret og godkender-udgivet. Se RLS + trigger '
  'i 0002/0003 for håndhævelse af skriveret.';

create index idx_content_world on content(world);
create index idx_content_type on content(content_type);
create index idx_content_published on content(is_published);
create index idx_content_age on content(min_age, max_age);

-- ----------------------------------------------------------------------------
-- lessons — samler content i rækkefølge
-- ----------------------------------------------------------------------------

create table lessons (
  id uuid primary key default gen_random_uuid(),
  world content_world not null,
  order_index int not null,
  title_da text not null,
  title_ar text,
  content_ids uuid[] not null default '{}',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lessons_world_order on lessons(world, order_index);

-- ----------------------------------------------------------------------------
-- progress — barnets fremskridt
-- ----------------------------------------------------------------------------

create table progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status progress_status not null default 'not_started',
  xp int not null default 0 check (xp >= 0),
  streak_count int not null default 0 check (streak_count >= 0),
  last_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, lesson_id)
);

create index idx_progress_profile on progress(profile_id);

-- ----------------------------------------------------------------------------
-- classes / class_members — lærer-funktion
-- ----------------------------------------------------------------------------

create table classes (
  id uuid primary key default gen_random_uuid(),
  teacher_account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, profile_id)
);

create index idx_class_members_class on class_members(class_id);
create index idx_class_members_profile on class_members(profile_id);

-- ----------------------------------------------------------------------------
-- media — bibliotek
-- ----------------------------------------------------------------------------

create table media (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('image', 'audio')),
  url text not null,
  tags text[] not null default '{}',
  generated_by media_generated_by not null,
  is_recitation boolean not null default false,
  reusable boolean not null default true,
  created_by uuid references accounts(id),
  created_at timestamptz not null default now(),

  -- AI-lyd må aldrig markeres som recitation (lyd-reglen i SKILL.md).
  constraint ai_never_recitation check (
    not (generated_by = 'ai' and is_recitation = true)
  )
);

create index idx_media_type on media(type);
create index idx_media_tags on media using gin(tags);

-- ----------------------------------------------------------------------------
-- content_reports — fejlrapporter
-- ----------------------------------------------------------------------------

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references content(id) on delete cascade,
  reporter_account_id uuid references accounts(id),
  note text,
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_content_reports_content on content_reports(content_id);
create index idx_content_reports_status on content_reports(status);

-- ----------------------------------------------------------------------------
-- updated_at auto-touch
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
