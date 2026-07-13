-- ============================================================================
-- content_udvid_mod_0001: bringer live content-tabellen i overensstemmelse
-- med repoets 0001-design. Deployeret 2026-07-13 mod ifwlbfuzkuidfzqsvnjz.
-- Tabellen var tom (verificeret 0 rækker), så not null uden backfill var sikkert.
-- Rører IKKE: aqidah-mur-trigger, RLS-policies, eksisterende constraints.
--
-- Verificeret efter deploy (alle bestået, rullet tilbage):
--   aqidah med sacred_representation='none'   → AFVIST (aqidah_must_use_light)
--   aqidah i bogstavernes_dal                 → AFVIST (aqidah_only_in_historiernes_bjerge)
--   aqidah uden source_reference/lås          → AFVIST (aqidah_requires_source)
--   aqidah udgivet uden verifikation          → AFVIST (AQIDAH_WALL-trigger, før constraint)
--   lovlig ai_allowed-række                   → INDSAT
--   mur-regression: editor-claim udgiver fuldt lovlig aqidah → AFVIST (AQIDAH_WALL)
-- ============================================================================

-- 1) Titelfelter
alter table content add column title_da text not null;
alter table content add column title_ar text;

comment on column content.title_da is 'Dansk titel (påkrævet — dansk bærer al instruktion).';
comment on column content.title_ar is 'Arabisk titel (valgfri).';

-- 2) Lys-reglen: sacred_representation (enum findes allerede i live-DB)
alter table content
  add column sacred_representation sacred_representation not null default 'none';

comment on column content.sacred_representation is
  'light = indholdet refererer til Profeten (ﷺ)/de 12 imamer og MÅ KUN repræsentere dem som lys. '
  'none = ingen hellig reference. Der findes bevidst ingen skikkelse-værdi i enum''et.';

-- 3) Tre aldersvarianter (én verden, tre skind)
alter table content add column body_da_simple text;
alter table content add column body_da_medium text;
alter table content add column body_da_deep text;

comment on column content.body_da_simple is 'Tekstvariant til 3-6 år (lyd/ikon-drevet skind).';
comment on column content.body_da_medium is 'Tekstvariant til 7-10 år.';
comment on column content.body_da_deep is 'Tekstvariant til 11-14 år (historisk dybde).';

-- 4) Declarative aqidah-constraints (defense-in-depth ved siden af triggeren)
alter table content add constraint aqidah_requires_source check (
  content_type <> 'aqidah'
  or (source_reference is not null and is_locked_from_ai = true)
);

alter table content add constraint aqidah_publish_requires_verification check (
  not (content_type = 'aqidah' and is_published = true and is_source_verified = false)
);

alter table content add constraint aqidah_only_in_historiernes_bjerge check (
  content_type <> 'aqidah' or world = 'historiernes_bjerge'
);

alter table content add constraint aqidah_must_use_light check (
  content_type <> 'aqidah' or sacred_representation = 'light'
);

-- 5) Indexes fra 0001-designet
create index idx_content_world on content(world);
create index idx_content_type on content(content_type);
create index idx_content_published on content(is_published);
create index idx_content_age on content(min_age, max_age);
