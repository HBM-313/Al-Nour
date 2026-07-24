-- Leverance D1 (fortsat): selve skrive-vejen. record_item_stat() er den
-- ATOMISKE upsert de tre spil (Lyt & Find, Tegn Bogstavet, Match-par)
-- kalder når et bogstav/ord vises og besvares. Samme SECURITY DEFINER +
-- tre-vejs ejerskabstjek-mønster som record_progress() (forælder / admin /
-- barnets egen session via auth_user_id).

create or replace function public.record_item_stat(
  p_profile_id uuid,
  p_item_type text,
  p_item_id uuid,
  p_correct boolean
)
returns public.profile_item_stats
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result public.profile_item_stats;
  v_owned boolean;
begin
  if p_profile_id is null or p_item_type is null or p_item_id is null then
    raise exception 'record_item_stat: profile_id, item_type og item_id er påkrævet';
  end if;
  if p_correct is null then
    raise exception 'record_item_stat: correct er påkrævet';
  end if;
  if p_item_type not in ('letter', 'vocabulary') then
    raise exception 'record_item_stat: item_type skal være letter eller vocabulary';
  end if;

  -- Ejerskabstjek FØR nogen skrivning, samme tre veje som record_progress:
  -- forælder (owner_account_id), admin, eller barnets egen session
  -- (profiles.auth_user_id = auth.uid() — den faktiske signerede bruger,
  -- aldrig et klient-styret claim).
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and (
        p.owner_account_id = auth.uid()
        or auth_user_role() = 'admin'
        or (auth_user_role() = 'child' and p.auth_user_id = auth.uid())
      )
  ) into v_owned;

  if not v_owned then
    raise exception 'record_item_stat: ikke autoriseret til denne profil';
  end if;

  insert into public.profile_item_stats
    (profile_id, item_type, item_id, seen_count, correct_count, last_seen_day)
  values
    (p_profile_id, p_item_type, p_item_id, 1, case when p_correct then 1 else 0 end, current_date)
  on conflict (profile_id, item_type, item_id) do update
    set seen_count    = public.profile_item_stats.seen_count + 1,
        correct_count = public.profile_item_stats.correct_count
                         + case when p_correct then 1 else 0 end,
        last_seen_day = current_date
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.record_item_stat(uuid, text, uuid, boolean) from public;
grant execute on function public.record_item_stat(uuid, text, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Regressionstest (mur-stil, rollback-markør, 0 rækker efterladt) kørt og
-- bestået mod live-DB ved implementering — se docs/handoff.md for resultatet.
-- Tjekket: forælder skriver for eget barn ✓ · akkumulering over to kald ✓ ·
-- fremmed forælder afvist ✓ · barnets egen session skriver for sig selv ✓ ·
-- barnets session afvist for søskendes profil ✓ · ugyldig item_type afvist ✓.
-- ---------------------------------------------------------------------------
