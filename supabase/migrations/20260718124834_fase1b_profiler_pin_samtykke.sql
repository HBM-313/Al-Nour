-- Profiler & auth-fundament: erstat plaintext pin_sequence med hashet pin,
-- tilføj stemmevalg på profilen, og samtykke-felter på accounts (GDPR §13).

alter table public.profiles
  add column if not exists pin_hash text,
  add column if not exists preferred_voice text not null default 'female';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_preferred_voice_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_voice_check
      check (preferred_voice in ('female','male'));
  end if;
end $$;

-- pin_sequence var ubrugt (0 rækker) og ville have gemt koden i klartekst — fjernes.
alter table public.profiles drop column if exists pin_sequence;

alter table public.accounts
  add column if not exists consent_given_at timestamptz,
  add column if not exists consent_version text;

-- Server-side pin-tjek: eksponerer aldrig pin_hash til klienten.
create or replace function public.verify_child_pin(p_profile_id uuid, p_attempt text[])
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.profiles
    where id = p_profile_id
      and pin_hash is not null
      and pin_hash = extensions.crypt(array_to_string(p_attempt, ','), pin_hash)
  );
$$;

-- Sætter/ændrer pin: kun ejer af profilen (forælder) eller admin.
create or replace function public.set_child_pin(p_profile_id uuid, p_sequence text[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_profile_id
      and (owner_account_id = auth.uid() or auth_user_role() = 'admin')
  ) then
    raise exception 'not authorized';
  end if;

  update public.profiles
    set pin_hash = extensions.crypt(array_to_string(p_sequence, ','), extensions.gen_salt('bf'))
    where id = p_profile_id;
end;
$$;

revoke all on function public.verify_child_pin(uuid, text[]) from public;
grant execute on function public.verify_child_pin(uuid, text[]) to authenticated, anon;

revoke all on function public.set_child_pin(uuid, text[]) from public;
grant execute on function public.set_child_pin(uuid, text[]) to authenticated;
