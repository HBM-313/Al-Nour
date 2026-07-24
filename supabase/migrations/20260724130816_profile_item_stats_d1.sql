-- Leverance D1 (plan-boernesession-og-dashboard.md, del 6.2): datalag for
-- item-statistik. Denne fil REKONSTRUERER en migration der allerede var
-- anvendt direkte på live-DB (version 20260724130816, "profile_item_stats_d1")
-- men aldrig blev committet til repoet — fundet ved sessionens skema-
-- drift-tjek. Idempotent med vilje, så filen er et no-op hvis kørt igen mod
-- live, og opretter alt fra bunden på et frisk miljø. INGEN data gik tabt
-- (tabellen havde 0 rækker ved fundet).
--
-- Rene tællere, IKKE en hændelseslog — se kommentar på tabellen. Dette er
-- kun datalaget; selve skrive-RPC'en (record_item_stat) og koblingen fra de
-- tre spil er en separat migration/leverance i samme session.

create table if not exists public.profile_item_stats (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  item_type      text not null check (item_type in ('letter', 'vocabulary')),
  item_id        uuid not null,
  seen_count     integer not null default 0 check (seen_count >= 0),
  correct_count  integer not null default 0 check (correct_count >= 0),
  last_seen_day  date not null default current_date,
  updated_at     timestamptz not null default now(),
  primary key (profile_id, item_type, item_id)
);

comment on table public.profile_item_stats is
  'Rene tællere pr. barn × item (bogstav eller ord) — bevidst IKKE en '
  'hændelseslog. seen_count/correct_count akkumuleres over tid; '
  'last_seen_day er en DATO, ikke et tidsstempel (samme begrundelse som '
  'profiles.last_active_day: undgår tidszonefejl og er den mindst '
  'indgribende form der stadig kan vise pædagogiske mønstre, fx "Ali '
  'forveksler ofte ب og ت"). Se plan-boernesession-og-dashboard.md §6.2.';

alter table public.profile_item_stats enable row level security;

-- Samme mønster som profiles_owner_all / progress_owner_all.
drop policy if exists profile_item_stats_owner_all on public.profile_item_stats;
create policy profile_item_stats_owner_all on public.profile_item_stats
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_item_stats.profile_id
        and (p.owner_account_id = auth.uid() or auth_user_role() = 'admin')
    )
  );

-- Samme mønster som progress_child_select_own: barnet ser kun egne tal,
-- skriver aldrig direkte (kun via record_item_stat, SECURITY DEFINER).
drop policy if exists profile_item_stats_child_select_own on public.profile_item_stats;
create policy profile_item_stats_child_select_own on public.profile_item_stats
  for select
  using (
    auth_user_role() = 'child'
    and exists (
      select 1 from public.profiles p
      where p.id = profile_item_stats.profile_id and p.auth_user_id = auth.uid()
    )
  );

-- Fremadrettet for lærer/klasse-funktionen (plan §3.5, tabeller findes,
-- endnu ubrugte) — harmløs allerede nu, da classes/class_members er tomme.
drop policy if exists profile_item_stats_teacher_read on public.profile_item_stats;
create policy profile_item_stats_teacher_read on public.profile_item_stats
  for select
  using (
    auth_user_role() = 'teacher'
    and exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.profile_id = profile_item_stats.profile_id
        and c.teacher_account_id = auth.uid()
    )
  );

drop trigger if exists trg_profile_item_stats_updated_at on public.profile_item_stats;
create trigger trg_profile_item_stats_updated_at
  before update on public.profile_item_stats
  for each row execute function public.set_updated_at();
