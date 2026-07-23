-- Leverance B2 (plan-boernesession-og-dashboard.md, del 4) — rate limiting
-- for barnets dyre-pin, og lock-down af den nu-erstattede statsløse
-- verify_child_pin-RPC. Se supabase/migrations/README.md for fuld
-- baggrund, testresultater og de to bugs regressionstesten fangede
-- undervejs (ulåst profil blokeret af efterladt rate-limit-tilstand;
-- ukendt profil-id ville have kastet en rå FK-fejl).
--
-- Designvalg: hele logikken (rate-tjek + pin-verifikation + forsøgs-
-- registrering) ligger i ÉN atomisk SECURITY DEFINER-funktion, samme
-- mønster som record_progress(). Kun Edge Function `child-signin` (via
-- service-rollen) kalder denne — den er IKKE tilgængelig for
-- anon/authenticated.

create table if not exists public.pin_attempts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz not null default now()
);

alter table public.pin_attempts enable row level security;
-- Bevidst INGEN policies: fail-closed for anon/authenticated. Kun
-- attempt_child_pin() (SECURITY DEFINER, ejet af postgres) og service_role
-- rører denne tabel.

create or replace function public.pin_attempt_delay_seconds(p_count integer)
returns integer
language sql
immutable
as $function$
  select case
    when p_count <= 2 then 0
    when p_count = 3 then 5
    when p_count = 4 then 15
    when p_count = 5 then 30
    else 60
  end;
$function$;

-- Rækkefølge er bevidst (se README): profilen slås op FØRST (så et ukendt
-- id aldrig rammer FK'en på pin_attempts og aldrig rate-limitedes for evigt
-- på andres vegne), og pin_hash tjekkes FØR rate-limit-forsinkelsen
-- håndhæves (så en ulåst profil aldrig kan blokeres af en efterladt
-- attempts-række).
create or replace function public.attempt_child_pin(p_profile_id uuid, p_attempt text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_row public.pin_attempts%rowtype;
  v_pin_hash text;
  v_required_wait integer;
  v_remaining numeric;
  v_new_count integer;
begin
  if p_profile_id is null then
    raise exception 'profile_id kraeves';
  end if;

  select pin_hash into v_pin_hash from public.profiles where id = p_profile_id;
  if not found then
    return jsonb_build_object('status', 'invalid', 'wait_seconds', 0, 'attempt_count', 0);
  end if;

  insert into public.pin_attempts (profile_id)
  values (p_profile_id)
  on conflict (profile_id) do nothing;

  select * into v_row from public.pin_attempts where profile_id = p_profile_id for update;

  -- Tidsforfald: en gammel fejlserie glemmes efter 30 minutter, så barnet
  -- aldrig bærer en gammel fejlserie med sig resten af dagen.
  if v_row.attempt_count > 0 and v_row.last_attempt_at < now() - interval '30 minutes' then
    update public.pin_attempts set attempt_count = 0 where profile_id = p_profile_id;
    v_row.attempt_count := 0;
  end if;

  -- Ulåst profil (bevidst ejer-beslutning): ingen hemmelighed at beskytte,
  -- derfor ingen rate limit og ingen påvirkning af en evt. gammel række.
  if v_pin_hash is null then
    return jsonb_build_object('status', 'ok', 'pin_required', false);
  end if;

  if v_row.attempt_count > 0 then
    v_required_wait := public.pin_attempt_delay_seconds(v_row.attempt_count);
    v_remaining := extract(epoch from (v_row.last_attempt_at + (v_required_wait || ' seconds')::interval - now()));
    if v_remaining > 0 then
      return jsonb_build_object(
        'status', 'rate_limited',
        'wait_seconds', ceil(v_remaining)::integer,
        'attempt_count', v_row.attempt_count
      );
    end if;
  end if;

  if v_pin_hash = extensions.crypt(array_to_string(p_attempt, ','), v_pin_hash) then
    delete from public.pin_attempts where profile_id = p_profile_id;
    return jsonb_build_object('status', 'ok', 'pin_required', true);
  end if;

  v_new_count := v_row.attempt_count + 1;
  update public.pin_attempts
    set attempt_count = v_new_count, last_attempt_at = now()
    where profile_id = p_profile_id;

  return jsonb_build_object(
    'status', 'invalid',
    'wait_seconds', public.pin_attempt_delay_seconds(v_new_count),
    'attempt_count', v_new_count
  );
end;
$function$;

revoke all on function public.attempt_child_pin(uuid, text[]) from public, anon, authenticated;
revoke all on function public.pin_attempt_delay_seconds(integer) from public, anon, authenticated;
grant execute on function public.attempt_child_pin(uuid, text[]) to service_role;
grant execute on function public.pin_attempt_delay_seconds(integer) to service_role;
revoke all on table public.pin_attempts from public, anon, authenticated;

-- KRITISK SIKKERHEDSFUND under implementeringen: verify_child_pin (den
-- ældre, statsløse boolean-RPC fra Leverance "fase1b_profiler_pin_samtykke")
-- var granted EXECUTE til anon/authenticated og har INGEN rate limiting.
-- Havde den forblivet frit tilgængelig, kunne den bruges som en
-- ubegrænset orakel til at gætte pin'en (op til 1320 kombinationer gættet
-- på sekunder) UDEN OM attempt_child_pin's rate limiter — hele
-- rate-limiting-arbejdet ovenfor ville have været ren kosmetik.
-- child-signin (og dermed attempt_child_pin) er nu den ENESTE vej til at
-- verificere en pin. set_child_pin er UPÅVIRKET: den kræver allerede en
-- ægte forælder/admin-session (owner_account_id = auth.uid()), ikke en
-- gættelig pin, og har derfor ikke samme sårbarhed.
revoke execute on function public.verify_child_pin(uuid, text[]) from anon, authenticated;
