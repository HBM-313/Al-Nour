-- Leverance 1.2 (plan-platformsmodning.md §1.2): atomisk, idempotent
-- progress-gemning. Erstatter klientens "læs-derefter-skriv" (progress.ts)
-- med én atomisk Postgres-funktion, så to faner eller en kø-genafspilning
-- (Leverance 1.1) ikke kan tabe xp eller ødelægge streak.
--
-- Xp-semantik: klienten sender xp som DELTA pr. runde (lægges til det
-- eksisterende), ikke kumulativ tilstand — uændret fra den hidtidige
-- frontend-logik.
--
-- Idempotens: hvert kald bærer et event_id (progress_events). Samme
-- event_id kaldt to gange (kø-replay efter afbrudt forbindelse) er et
-- bevidst no-op — xp lægges IKKE til igen. Almindelige nye kald anvendes
-- normalt.
--
-- Streak-regel (uændret fra progress.ts, nu i DB): samme dag → uændret;
-- i går → +1; ellers (eller første gang) → 1. Kendt begrænsning, bevidst
-- ikke rettet her: reglen er stadig lektions-specifik
-- (UNIQUE(profile_id, lesson_id)), ikke global — det retter Leverance 1.3.
--
-- Fuldført lektion nulstiller current_step til 0 (klar til genspil),
-- som hidtidig frontend-adfærd.
--
-- Bevist med 11-punkts rollback-markør-regressionstest (se
-- README.md i denne mappe for scenarielisten). 0 rækker persisteret ved test.

create table if not exists public.progress_events (
  event_id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Fail-closed: RLS slået til, bevidst INGEN policies. Tabellen røres
-- udelukkende af record_progress (SECURITY DEFINER, ejet af superuser og
-- bypasser derfor RLS internt) — ingen klient kan læse/skrive den direkte
-- via API'et.
alter table public.progress_events enable row level security;

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
  v_prev public.progress;
  v_now timestamptz := now();
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

  -- Samme ejerskabs-tjek som set_child_pin: kun forælderens egen profil,
  -- eller admin.
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id
      and (owner_account_id = auth.uid() or auth_user_role() = 'admin')
  ) then
    raise exception 'record_progress: ikke autoriseret til profil %', p_profile_id;
  end if;

  -- Idempotens: registrér hændelsen. Findes event_id allerede (kø-replay /
  -- dobbelt-synk), er kaldet et no-op — vi returnerer blot nuværende
  -- tilstand uden at anvende ændringen igen.
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

  select * into v_prev from public.progress
    where profile_id = p_profile_id and lesson_id = p_lesson_id
    for update;

  if v_prev is null or v_prev.last_completed_at is null then
    v_streak := 1;
  elsif (v_prev.last_completed_at)::date = (v_now)::date then
    v_streak := v_prev.streak_count;
  elsif (v_prev.last_completed_at)::date = ((v_now)::date - 1) then
    v_streak := v_prev.streak_count + 1;
  else
    v_streak := 1;
  end if;

  insert into public.progress as pr (
    profile_id, lesson_id, status, xp, current_step, streak_count, last_completed_at
  )
  values (
    p_profile_id, p_lesson_id,
    case when p_completed then 'completed'::public.progress_status else 'in_progress'::public.progress_status end,
    p_earned_xp,
    case when p_completed then 0 else p_current_step end,
    v_streak,
    v_now
  )
  on conflict (profile_id, lesson_id) do update
  set
    status = excluded.status,
    xp = pr.xp + excluded.xp,
    current_step = excluded.current_step,
    streak_count = v_streak,
    last_completed_at = v_now,
    updated_at = v_now
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.record_progress(uuid, uuid, uuid, integer, integer, boolean) from public;
grant execute on function public.record_progress(uuid, uuid, uuid, integer, integer, boolean) to authenticated;
