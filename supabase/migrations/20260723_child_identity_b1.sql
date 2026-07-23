-- Leverance B1 (plan-boernesession-og-dashboard.md, del 4):
-- barnets identitet i databasen. Hver børneprofil kan nu (efter provisionering
-- via Edge Function provision-child-auth) have sin egen auth.users-række med
-- en syntetisk e-mail (c-<profil-uuid>@child.nour.invalid). Dette er KUN
-- database-laget: RLS, kolonnen, whitelisten og record_progress-udvidelsen.
-- Selve pin-login der udsteder en session er Leverance B2.
--
-- child-rollen tildeles UDELUKKENDE af custom_access_token_hook ud fra
-- profiles.auth_user_id — aldrig af klienten (hård regel, se instruktion.md).

-- ---------------------------------------------------------------------------
-- 1. profiles.auth_user_id
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'auth_user_id'
  ) then
    alter table public.profiles
      add column auth_user_id uuid unique references auth.users(id) on delete set null;
  end if;
end $$;

comment on column public.profiles.auth_user_id is
  'Barnets egen auth.users-id, sat af provision_child_auth via Edge Function. '
  'NULL indtil profilen er aktiveret. Aldrig skrivbar af nogen klient-rolle — '
  'kun af service-rollen der provisionerer. Bruges af custom_access_token_hook '
  'til at udstede user_role=''child''-claimet.';

-- ---------------------------------------------------------------------------
-- 2. custom_access_token_hook: tilføj child-gren
--    (accounts-tjekket bevares uændret og går forud; kun hvis brugeren
--    IKKE har en accounts-række, tjekkes profiles.auth_user_id.)
-- ---------------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  claims jsonb;
  acct_role public.account_role;
  child_profile_id uuid;
  event_user_id uuid;
begin
  event_user_id := (event->>'user_id')::uuid;

  select role into acct_role
  from public.accounts
  where id = event_user_id;

  claims := coalesce(event->'claims', '{}'::jsonb);

  if acct_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(acct_role::text));
  else
    -- Ingen konto — er det et barn? child-rollen er UDELUKKENDE bestemt af
    -- profiles.auth_user_id, som kun service-rollen (provision_child_auth)
    -- må skrive til. Klienten kan aldrig fremtvinge dette claim.
    select id into child_profile_id
    from public.profiles
    where auth_user_id = event_user_id;

    if child_profile_id is not null then
      claims := jsonb_set(claims, '{user_role}', to_jsonb('child'::text));
      claims := jsonb_set(claims, '{profile_id}', to_jsonb(child_profile_id::text));
    else
      claims := jsonb_set(claims, '{user_role}', to_jsonb('anon'::text));
    end if;
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Kolonne-hvidliste for barnets egen UPDATE på profiles
--    (RLS USING/WITH CHECK kan ikke sammenligne mod OLD-rækken direkte —
--    samme trigger-mønster som protect_account_role_and_id.)
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_child_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- postgres = SECURITY DEFINER-funktioner (record_progress m.fl.) skal
  -- fortsat kunne skrive streak/level osv. på vegne af et barn.
  if current_user <> 'postgres' and auth_user_role() = 'child' then
    if new.id is distinct from old.id
      or new.owner_account_id is distinct from old.owner_account_id
      or new.auth_user_id is distinct from old.auth_user_id
      or new.display_name is distinct from old.display_name
      or new.avatar is distinct from old.avatar
      or new.birth_year is distinct from old.birth_year
      or new.pin_hash is distinct from old.pin_hash
      or new.current_level is distinct from old.current_level
      or new.streak_count is distinct from old.streak_count
      or new.last_active_day is distinct from old.last_active_day
    then
      raise exception 'protect_profile_child_columns: barnets session må kun ændre preferred_voice, transliteration_enabled og ui_language';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_profiles_protect_child_columns on public.profiles;
create trigger trg_profiles_protect_child_columns
  before update on public.profiles
  for each row execute function public.protect_profile_child_columns();

-- ---------------------------------------------------------------------------
-- 4. RLS: barnets egen session (fail-closed, additive — rører ikke
--    profiles_owner_all / progress_owner_all)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_child_select_own on public.profiles;
create policy profiles_child_select_own on public.profiles
  for select
  using (auth_user_role() = 'child' and auth_user_id = auth.uid());

drop policy if exists profiles_child_update_own on public.profiles;
create policy profiles_child_update_own on public.profiles
  for update
  using (auth_user_role() = 'child' and auth_user_id = auth.uid())
  with check (auth_user_role() = 'child' and auth_user_id = auth.uid());

drop policy if exists progress_child_select_own on public.progress;
create policy progress_child_select_own on public.progress
  for select
  using (
    auth_user_role() = 'child'
    and exists (
      select 1 from public.profiles p
      where p.id = progress.profile_id and p.auth_user_id = auth.uid()
    )
  );
-- Bevidst INGEN insert/update/delete-policy for child på progress:
-- skrivning sker udelukkende via record_progress() (SECURITY DEFINER).
-- Default-deny gælder.

-- ---------------------------------------------------------------------------
-- 5. record_progress(): acceptér også barnets egen session
--    Ejerskabstjekket er ét sted i funktionen — kirurgisk udvidelse af
--    WHERE-klausulen i den eksisterende SELECT ... FOR UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.record_progress(
  p_event_id uuid,
  p_profile_id uuid,
  p_lesson_id uuid,
  p_earned_xp integer,
  p_current_step integer,
  p_completed boolean
)
returns public.progress
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result public.progress;
  v_prev_last_active date;
  v_prev_streak integer;
  v_now timestamptz := now();
  v_today date;
  v_streak integer;
  v_is_duplicate boolean := false;
begin
  if p_event_id is null then
    raise exception 'record_progress: event_id er påkrævet';
  end if;
  if p_earned_xp is null or p_earned_xp < 0 then
    raise exception 'record_progress: earned_xp skal være >= 0';
  end if;
  if p_current_step is null or p_current_step < 0 then
    raise exception 'record_progress: current_step skal være >= 0';
  end if;
  if p_profile_id is null or p_lesson_id is null then
    raise exception 'record_progress: profile_id og lesson_id er påkrævet';
  end if;

  v_today := (v_now)::date;

  -- Lås profil-rækken FØRST og tjek ejerskab i samme kald. Tre veje ind:
  -- forælder (owner_account_id), admin, eller barnets egen session
  -- (profiles.auth_user_id = auth.uid() — den faktiske signerede bruger,
  -- ikke et klient-styret claim).
  select streak_count, last_active_day
    into v_prev_streak, v_prev_last_active
    from public.profiles
    where id = p_profile_id
      and (
        owner_account_id = auth.uid()
        or auth_user_role() = 'admin'
        or (auth_user_role() = 'child' and auth_user_id = auth.uid())
      )
    for update;

  if not found then
    raise exception 'record_progress: ikke autoriseret til profil %', p_profile_id;
  end if;

  -- Idempotens (uændret fra Leverance 1.2): registrér hændelsen. Findes
  -- event_id allerede (kø-replay / dobbelt-synk), er kaldet et no-op.
  begin
    insert into public.progress_events (event_id, profile_id, lesson_id)
    values (p_event_id, p_profile_id, p_lesson_id);
  exception when unique_violation then
    v_is_duplicate := true;
  end;

  if v_is_duplicate then
    select * into v_result from public.progress
      where profile_id = p_profile_id and lesson_id = p_lesson_id;
    return v_result;
  end if;

  -- Global streak-regel (uændret fra §1.3): samme dag → uændret; i går →
  -- +1; ellers (eller første gang) → 1.
  if v_prev_last_active is null then
    v_streak := 1;
  elsif v_prev_last_active = v_today then
    v_streak := v_prev_streak;
  elsif v_prev_last_active = v_today - 1 then
    v_streak := v_prev_streak + 1;
  else
    v_streak := 1;
  end if;

  update public.profiles
    set streak_count = v_streak,
        last_active_day = v_today
    where id = p_profile_id;

  insert into public.progress as pr (
    profile_id, lesson_id, status, xp, current_step, last_completed_at
  )
  values (
    p_profile_id, p_lesson_id,
    case when p_completed then 'completed'::public.progress_status else 'in_progress'::public.progress_status end,
    p_earned_xp,
    case when p_completed then 0 else p_current_step end,
    v_now
  )
  on conflict (profile_id, lesson_id) do update
  set
    status = excluded.status,
    xp = pr.xp + excluded.xp,
    current_step = excluded.current_step,
    last_completed_at = v_now,
    updated_at = v_now
  returning * into v_result;

  return v_result;
end;
$function$;
