-- ============================================================
-- 1) LUK ROLLE-SELVFORFREMMELSES-HULLET på accounts
--    accounts_update_own havde ingen WITH CHECK der begrænsede
--    HVILKE kolonner der må ændres. Bevist ved test 2026-07-18:
--    en almindelig forælder kunne sætte sin egen role='admin'.
--
--    VIGTIGT: security invoker (IKKE definer) — funktionen skal
--    se den RIGTIGE kalders current_user, ikke funktionsejerens.
--
--    Blokerer kun den klient-vendte vej (authenticated/anon/
--    service_role via PostgREST). Direkte SQL-adgang (Dashboard
--    SQL-editor, migrationer) fra `postgres`-rollen er UNDTAGET,
--    så den allerførste admin-konto kan bootstrappes manuelt.
--    Fremtidige rolle-forfremmelser bør ske via en dedikeret
--    admin-kun RPC (Fase C admin-dashboard), ikke via denne bagdør.
-- ============================================================

create or replace function public.protect_account_role_and_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.id is distinct from old.id) then
    if current_user <> 'postgres' and auth_user_role() <> 'admin' then
      raise exception 'Kun admin kan ændre rolle eller id på en konto';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.protect_account_role_and_id() is
  'Del af muren: forhindrer at en bruger selv ændrer sin role/id via accounts_update_own. security invoker er bevidst (skal se ægte current_user). Kun auth_user_role()=admin (rigtig admin-JWT) eller direkte postgres-SQL-adgang (bootstrap) kan ændre disse felter.';

drop trigger if exists trg_accounts_protect_role on public.accounts;
create trigger trg_accounts_protect_role
  before update on public.accounts
  for each row execute function public.protect_account_role_and_id();


-- ============================================================
-- 2) ensure_parent_account() — signup-mekanisme (RPC, ikke trigger)
--    Kaldes af klienten efter login. Idempotent. role hardcodet
--    'parent' — kan IKKE parametriseres af klienten.
-- ============================================================

create or replace function public.ensure_parent_account()
returns public.accounts
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  acc public.accounts;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then
    raise exception 'ensure_parent_account: ingen autentificeret bruger';
  end if;

  select email into uemail from auth.users where id = uid;
  if uemail is null then
    raise exception 'ensure_parent_account: bruger % findes ikke i auth.users', uid;
  end if;

  insert into public.accounts (id, email, role)
  values (uid, uemail, 'parent')
  on conflict (id) do nothing;

  select * into acc from public.accounts where id = uid;
  return acc;
end;
$$;

comment on function public.ensure_parent_account() is
  'Signup-mekanisme (RPC). Opretter accounts-række for auth.uid() hvis den mangler. role er hardcodet parent og kan ikke sættes af klienten. Idempotent — sikkert at kalde ved hvert login.';

revoke all on function public.ensure_parent_account() from public, anon;
grant execute on function public.ensure_parent_account() to authenticated;


-- ============================================================
-- 3) custom_access_token_hook — rolle ind i JWT
--    Aktiveret i Dashboard (Authentication → Hooks → Custom Access
--    Token → public.custom_access_token_hook) 2026-07-18.
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
  acct_role public.account_role;
begin
  select role into acct_role
  from public.accounts
  where id = (event->>'user_id')::uuid;

  claims := coalesce(event->'claims', '{}'::jsonb);

  if acct_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(acct_role::text));
  else
    claims := jsonb_set(claims, '{user_role}', to_jsonb('anon'::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Supabase Auth Custom Access Token Hook. Synkroniserer accounts.role ind i JWTets user_role-claim ved hver token-udstedelse/refresh. Registreret i Dashboard: Authentication -> Hooks -> Custom Access Token.';

revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;


-- ============================================================
-- 4) REGRESSIONSTESTS (mur-stil: DO-blokke, rollback, 0 rækker efterladt)
--    Kørt og bestået ved deployment 2026-07-18: ensure_parent_account
--    (opret + idempotens), rolle-beskyttelse (parent blokeret, admin
--    tilladt), hook-claim korrekt. Bevaret her for regressionsdokumentation
--    — DO-blokkene ruller sig selv tilbage og efterlader 0 rækker.
-- ============================================================

do $$
declare
  test_id uuid := '8ace1757-72c6-4ff0-ba19-9dc4f52e5007'; -- test-foraelder
  result_email text;
  result_role public.account_role;
  row_count int;
begin
  delete from public.accounts where id = test_id; -- simulér "ny bruger"

  perform set_config('request.jwt.claims', json_build_object('sub', test_id::text, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.ensure_parent_account();
  reset role;

  select email, role into result_email, result_role from public.accounts where id = test_id;
  if result_role is distinct from 'parent'::public.account_role or result_email is null then
    raise exception 'FEJL A1: forkert resultat email=%, role=%', result_email, result_role;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', test_id::text, 'role','authenticated')::text, true);
  set local role authenticated;
  perform public.ensure_parent_account(); -- andet kald, skal ikke fejle
  reset role;

  select count(*) into row_count from public.accounts where id = test_id;
  if row_count <> 1 then
    raise exception 'FEJL A2: idempotens fejlede, % rækker', row_count;
  end if;

  raise notice 'TEST A OK: ensure_parent_account virker og er idempotent';
  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

do $$
declare
  test_id uuid := '8ace1757-72c6-4ff0-ba19-9dc4f52e5007';
  role_after public.account_role;
  blocked boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', test_id::text, 'role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  begin
    update public.accounts set role = 'admin' where id = test_id;
  exception when others then
    blocked := true;
  end;
  reset role;

  if not blocked then
    raise exception 'FEJL B1: parent kunne ændre egen rolle!';
  end if;

  select role into role_after from public.accounts where id = test_id;
  if role_after <> 'parent' then
    raise exception 'FEJL B1b: rolle blev alligevel ændret til %', role_after;
  end if;
  raise notice 'TEST B1 OK: parent kan ikke selv-forfremme';

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated','user_role','admin')::text, true);
  set local role authenticated;
  update public.accounts set role = 'editor' where id = test_id;
  reset role;

  select role into role_after from public.accounts where id = test_id;
  if role_after <> 'editor' then
    raise exception 'FEJL B2: admin kunne ikke ændre rolle, fik %', role_after;
  end if;
  raise notice 'TEST B2 OK: admin kan ændre rolle';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

do $$
declare
  test_id uuid := '8ace1757-72c6-4ff0-ba19-9dc4f52e5007';
  result jsonb;
  claim text;
begin
  result := public.custom_access_token_hook(
    jsonb_build_object('user_id', test_id::text, 'claims', jsonb_build_object('sub', test_id::text))
  );
  claim := result->'claims'->>'user_role';
  if claim <> 'parent' then
    raise exception 'FEJL C: forventede user_role=parent, fik %', claim;
  end if;
  raise notice 'TEST C OK: hook returnerer korrekt claim (%)', claim;
end $$;
