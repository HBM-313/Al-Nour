-- Leverance 1.3 (plan-platformsmodning.md §1.3): global streak pr. barn i
-- stedet for pr. (profil, lektion).
--
-- Hidtil lå streak_count på progress med UNIQUE(profile_id, lesson_id) —
-- altså én streak PR LEKTION. Et barn der spiller trofast hver dag, men
-- skifter lektion, oplevede at streaken evigt viste "1". Rettet ved at
-- flytte streak til profiles (ét barn = én streak).
--
-- record_progress() låser nu profil-rækken (FOR UPDATE) FØRST og bruger
-- samme select til autorisationstjekket — streak er global, så samtidige
-- kald fra to forskellige lektioner/faner for samme barn skal serialiseres
-- her (var tidligere implicit sikret af UNIQUE(profile_id, lesson_id)-
-- låsen på progress-rækken, som ikke længere er nok når streak ikke er
-- pr.-lektion).
--
-- Samme streak-regel som hidtil, nu global: samme dag → uændret;
-- i går → +1; ellers (eller intet tidligere fremskridt) → 1.
--
-- ARKITEKTUR-BESLUTNING (bevidst ændring, ikke en rettelse af en fejl):
-- progress.streak_count FRYSES fra denne migration. Kolonnen fjernes
-- ikke (historik/audit — se migration 20260722_record_progress_atomic_rpc
-- for hvad der lå der før), men record_progress() sætter/opdaterer den
-- ikke længere. Nye progress-rækker får kolonnens default (0),
-- eksisterende rækkers værdier røres ikke. Al streak-visning skal
-- fremover læse profiles.streak_count.
--
-- Bevist med 8-punkts rollback-markør-regressionstest mod live-DB
-- (0 rækker persisteret) — se README.md, afsnit "Global streak", for den
-- fulde scenarieliste.

alter table public.profiles
  add column if not exists streak_count integer not null default 0,
  add column if not exists last_active_day date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_streak_count_check'
  ) then
    alter table public.profiles
      add constraint profiles_streak_count_check check (streak_count >= 0);
  end if;
end $$;

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

  -- Lås profil-rækken FØRST og tjek ejerskab i samme kald — streak er nu
  -- global pr. barn, så samtidige kald skal serialiseres her.
  select streak_count, last_active_day
    into v_prev_streak, v_prev_last_active
    from public.profiles
    where id = p_profile_id
      and (owner_account_id = auth.uid() or auth_user_role() = 'admin')
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

  -- Global streak-regel (flyttet fra pr.-lektion, jf. §1.3): samme dag →
  -- uændret; i går → +1; ellers (eller første gang) → 1.
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
