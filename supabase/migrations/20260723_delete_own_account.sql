-- Migration: delete_own_account() + luk deletion-graph-hullet (NO ACTION -> SET NULL)
-- Del af Leverance 1.4 (GDPR: forælderen kan slette sin egen konto). Skrevet 2026-07-23.

-- 1) content.created_by, content.published_by, content_reports.reporter_account_id og
--    media.created_by peger på accounts med ON DELETE NO ACTION. Det ville BLOKERE
--    kontosletning hvis kontoen (fx redaktør/godkender) har oprettet/publiceret indhold
--    eller rapporteret en fejl. Rettes til SET NULL (alle fire kolonner er nullable) —
--    selve indholdet/rapporten er ikke persondata og bevares; kun forfatter-referencen
--    fjernes ved sletning. Aqidah-muren berøres ikke (ingen CHECK-constraint afhænger
--    af disse kolonner).

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'content_created_by_fkey' and confdeltype <> 'n'
  ) then
    alter table public.content drop constraint content_created_by_fkey;
    alter table public.content add constraint content_created_by_fkey
      foreign key (created_by) references public.accounts(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'content_published_by_fkey' and confdeltype <> 'n'
  ) then
    alter table public.content drop constraint content_published_by_fkey;
    alter table public.content add constraint content_published_by_fkey
      foreign key (published_by) references public.accounts(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'content_reports_reporter_account_id_fkey' and confdeltype <> 'n'
  ) then
    alter table public.content_reports drop constraint content_reports_reporter_account_id_fkey;
    alter table public.content_reports add constraint content_reports_reporter_account_id_fkey
      foreign key (reporter_account_id) references public.accounts(id) on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'media_created_by_fkey' and confdeltype <> 'n'
  ) then
    alter table public.media drop constraint media_created_by_fkey;
    alter table public.media add constraint media_created_by_fkey
      foreign key (created_by) references public.accounts(id) on delete set null;
  end if;
end $$;

-- 2) delete_own_account(): sletter udelukkende kalderens egen konto (auth.uid()), aldrig
--    en klient-valgt id. auth.users-sletning cascader til accounts -> profiles ->
--    progress/progress_events/class_members, samt classes (hvis kontoen er lærer) ->
--    class_members.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'delete_own_account: ingen autentificeret bruger';
  end if;

  if not exists (select 1 from auth.users where id = uid) then
    raise exception 'delete_own_account: bruger findes ikke';
  end if;

  -- UDVIDELSESPUNKT (Leverance B3, plan-boernesession-og-dashboard.md):
  -- Når børn får egne auth.users-rækker (profiles.auth_user_id), skal en trigger på
  -- "profiles DELETE" slette den tilhørende barne-auth-bruger. Indtil da findes ingen
  -- børne-auth-brugere, og cascade fra profiles er tilstrækkeligt.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
