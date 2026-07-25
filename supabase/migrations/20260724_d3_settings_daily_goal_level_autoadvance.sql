-- Leverance D3.1 — indstillinger: dagens mål + niveau-fremgang
-- (plan-boernesession-og-dashboard.md §6.4, plan-platformsmodning.md §2.2).
--
-- EJER-BESLUTNINGER denne session (25):
--  1. Niveau-fremgang: AUTOMATISK via mestring (item-stats), forælderen kan
--     altid overstyre manuelt.
--     Claudes konkrete udmøntning af dette (IKKE selve spørgsmålet): uden en
--     "auto er slået fra"-kontakt ville en forælders manuelle nedjustering
--     blive overskrevet igen af den SAMME mestringsdata ved næste spillede
--     runde — "forælder kan overstyre" ville være tomme ord. Derfor
--     level_auto_advance_enabled (default true). Sættes til false af
--     klienten når en forælder manuelt vælger et niveau i dashboardet
--     (D3.2); forælderen kan slå automatikken til igen samme sted.
--  2. De 3 eksisterende profiler (Ali/Zainab/Hassan) rykkes op til niveau 2
--     med det samme (sektion 6 nedenfor) — de har reelt spillet i flere
--     sessioner på niveau 1 allerede.
--  3. "Dagens mål" bliver synligt for barnet som et roligt lys — det bygges
--     i D3.3 (frontend), ingen DB-konsekvens ud over selve kolonnen.
--
-- Skema-drift tjekket FØR denne migration (samme session, se
-- docs/handoff.md/opstart-prompt-7): profiles havde ingen af de to nye
-- kolonner; protect_profile_child_columns() er en SORTLISTE (ikke
-- hvidliste) og udvides derfor eksplicit her — ellers ville begge nye
-- kolonner som udgangspunkt være frit skrivbare for et barns egen session.

-- ---------------------------------------------------------------------------
-- 1. Nye kolonner (idempotent)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists daily_goal_lessons integer not null default 1
    check (daily_goal_lessons >= 1 and daily_goal_lessons <= 5);

alter table public.profiles
  add column if not exists level_auto_advance_enabled boolean not null default true;

comment on column public.profiles.daily_goal_lessons is
  'Forælder-sat dagligt MÅL (1-5 lektioner), ikke en spærring (§6.4). Barnet låses aldrig ude af at lære, uanset om målet er nået.';
comment on column public.profiles.level_auto_advance_enabled is
  'Styrer om evaluate_level_advance() må rykke current_level op automatisk. Default true. Sættes til false af klienten når en forælder manuelt vælger et niveau i D3.2-UI''et — ellers ville samme mestringsdata bare rykke niveauet op igen ved næste spillede runde. Forælderen kan slå automatikken til igen samme sted.';

-- ---------------------------------------------------------------------------
-- 2. Udvid barne-beskyttelsen (sortliste — se oprindelig funktion i
--    20260723_child_identity_b1.sql). Samme trigger genbruges uændret,
--    kun funktionens krop er ny.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_child_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- postgres = SECURITY DEFINER-funktioner (record_progress,
  -- evaluate_level_advance m.fl.) skal fortsat kunne skrive streak/level
  -- osv. på vegne af et barn.
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
      or new.daily_goal_lessons is distinct from old.daily_goal_lessons
      or new.level_auto_advance_enabled is distinct from old.level_auto_advance_enabled
    then
      raise exception 'protect_profile_child_columns: barnets session må kun ændre preferred_voice, transliteration_enabled og ui_language';
    end if;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Automatisk niveau-fremgang — evaluate_level_advance()
--
-- Intern helper, IKKE eksponeret til klienten (intet execute-grant til
-- authenticated/anon nedenfor). Kaldes udelukkende fra record_item_stat()
-- (sektion 4), hvor den — som SECURITY DEFINER — kører som funktionens
-- ejer (postgres) og derfor lovligt kan ændre current_level på trods af
-- protect_profile_child_columns' sortliste (samme 'current_user=postgres'-
-- undtagelse som record_progress bruger til streak/xp).
--
-- Tærskler er BEVIDST de samme som D2's learning.ts (MIN_SEEN=3,
-- KNOWN_RATE=0.70) — samme definition af "kan" et bogstav/ord, så
-- dashboardets tal og niveau-fremgangen aldrig modsiger hinanden.
-- ⚠️ DUPLIKERET DEFINITION — SQL kan ikke dele kode med TypeScript.
-- Ændres tærsklerne i learning.ts, SKAL de ændres her også (og omvendt).
--
-- Reglen: for barnets NUVÆRENDE niveau L (< 4), hvis mindst 70% af BÅDE
-- bogstaverne OG ordforrådet PÅ NETOP niveau L er "kendt" (mindst 3
-- eksponeringer, mindst 70% rigtige) — rykkes barnet til L+1. Findes der
-- intet af én kategori på niveauet (fx 0 bogstaver på niveau 2/3 i dag), er
-- den kategori vacuously opfyldt. Findes der INTET at lære på niveauet
-- overhovedet (begge tomme), rykkes der aldrig frem — det ville være
-- gætværk, ikke mestring.
create or replace function public.evaluate_level_advance(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_level integer;
  v_auto_enabled boolean;
  v_letters_total integer;
  v_letters_known integer;
  v_vocab_total integer;
  v_vocab_known integer;
begin
  select current_level, level_auto_advance_enabled
    into v_level, v_auto_enabled
    from public.profiles
    where id = p_profile_id
    for update;

  if v_level is null or v_level >= 4 or not v_auto_enabled then
    return;
  end if;

  select count(*) into v_letters_total
    from public.letters where level = v_level;

  select count(*) into v_letters_known
    from public.profile_item_stats s
    join public.letters l on l.id = s.item_id
    where s.profile_id = p_profile_id
      and s.item_type = 'letter'
      and l.level = v_level
      and s.seen_count >= 3
      and s.correct_count::numeric / s.seen_count >= 0.7;

  select count(*) into v_vocab_total
    from public.vocabulary where level = v_level and is_published = true;

  select count(*) into v_vocab_known
    from public.profile_item_stats s
    join public.vocabulary v on v.id = s.item_id
    where s.profile_id = p_profile_id
      and s.item_type = 'vocabulary'
      and v.level = v_level
      and v.is_published = true
      and s.seen_count >= 3
      and s.correct_count::numeric / s.seen_count >= 0.7;

  if v_letters_total = 0 and v_vocab_total = 0 then
    return; -- intet at måle niveauet på — ryk aldrig frem på gætværk
  end if;

  if (case when v_letters_total = 0 then true else v_letters_known::numeric / v_letters_total >= 0.7 end)
     and (case when v_vocab_total = 0 then true else v_vocab_known::numeric / v_vocab_total >= 0.7 end)
  then
    update public.profiles
      set current_level = v_level + 1
      where id = p_profile_id and current_level = v_level;
  end if;
end;
$function$;

revoke all on function public.evaluate_level_advance(uuid) from public;

-- ---------------------------------------------------------------------------
-- 4. Kobl automatikken til den faktiske skrive-vej (record_item_stat)
--
-- Kirurgisk udvidelse: samme signatur/grants som 20260724173453 (D1), kun
-- ét nyt kald tilføjet FØR return, i sin egen fejl-isolerede blok.
-- Fail-soft med vilje (samme princip som record_progress's egen item-stat-
-- blok): en fremtidig bug i niveau-fremgangen må ALDRIG koste selve tælle-
-- skrivningen, som allerede er gemt på dette tidspunkt i funktionen.
-- ---------------------------------------------------------------------------
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

  begin
    perform public.evaluate_level_advance(p_profile_id);
  exception when others then
    raise warning 'record_item_stat: niveau-fremgang sprunget over (%)', sqlerrm;
  end;

  return v_result;
end;
$function$;

revoke all on function public.record_item_stat(uuid, text, uuid, boolean) from public;
grant execute on function public.record_item_stat(uuid, text, uuid, boolean) to authenticated;

-- ============================================================
-- 5) REGRESSIONSTESTS (mur-stil: DO-blokke, rollback-markør, 0 rækker
--    efterladt — hver blok ruller sig selv tilbage via plpgsql's
--    automatiske savepoint ved EXCEPTION). Kørt FØR sektion 6's
--    engangs-oprykning, så testene ser den ægte "alle på niveau 1"-
--    tilstand. Fejler én test, fejler HELE migrationen (ingenting af
--    denne fil anvendes) — det er selve sikkerhedsnettet.
--
--    Testdata: Ali b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42 (ejet af
--    test-foraelder@nour.test, 8ace1757-…, auth_user_id 2ea57415-…);
--    "fremmed forælder" = ejerens egen admin-konto e0b8c5a6-…, som ejer
--    Hassan, ikke Ali.
-- ============================================================

-- TEST 1: forælder kan sætte daily_goal_lessons på eget barn.
do $$
declare
  v_goal integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  update public.profiles set daily_goal_lessons = 3
    where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  reset role;

  select daily_goal_lessons into v_goal from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_goal <> 3 then
    raise exception 'FEJL TEST1: forælder kunne ikke sætte daily_goal_lessons, fik %', v_goal;
  end if;
  raise notice 'TEST 1 OK: forælder kan sætte daily_goal_lessons på eget barn';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 2: barnets egen session kan IKKE ændre daily_goal_lessons.
do $$
declare
  blocked boolean := false;
  v_goal integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','2ea57415-f06d-4ab3-9e9c-db0cb100a5a8','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  begin
    update public.profiles set daily_goal_lessons = 5
      where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  exception when others then
    blocked := true;
  end;
  reset role;

  if not blocked then
    raise exception 'FEJL TEST2: barnets session kunne ændre daily_goal_lessons!';
  end if;

  select daily_goal_lessons into v_goal from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_goal <> 1 then
    raise exception 'FEJL TEST2b: daily_goal_lessons blev alligevel ændret til %', v_goal;
  end if;
  raise notice 'TEST 2 OK: barnets session kan ikke ændre daily_goal_lessons';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 3: barnets session KAN STADIG ændre transliteration_enabled og
-- preferred_voice — ingen regression fra triggerens udvidelse.
do $$
declare
  v_translit boolean;
  v_voice text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','2ea57415-f06d-4ab3-9e9c-db0cb100a5a8','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  update public.profiles
    set transliteration_enabled = false, preferred_voice = 'male'
    where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  reset role;

  select transliteration_enabled, preferred_voice into v_translit, v_voice
    from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_translit is distinct from false or v_voice <> 'male' then
    raise exception 'FEJL TEST3 (REGRESSION): barnets session kunne ikke længere ændre transliteration_enabled/preferred_voice, fik %, %', v_translit, v_voice;
  end if;
  raise notice 'TEST 3 OK: barnets session kan stadig ændre transliteration_enabled og preferred_voice';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 4: barnets session kan (fortsat) IKKE ændre current_level.
do $$
declare
  blocked boolean := false;
  v_level integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','2ea57415-f06d-4ab3-9e9c-db0cb100a5a8','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  begin
    update public.profiles set current_level = 4
      where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  exception when others then
    blocked := true;
  end;
  reset role;

  if not blocked then
    raise exception 'FEJL TEST4: barnets session kunne ændre current_level!';
  end if;

  select current_level into v_level from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_level <> 1 then
    raise exception 'FEJL TEST4b: current_level blev alligevel ændret til %', v_level;
  end if;
  raise notice 'TEST 4 OK: barnets session kan fortsat ikke ændre current_level';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 5: barnets session kan IKKE ændre level_auto_advance_enabled.
do $$
declare
  blocked boolean := false;
  v_flag boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','2ea57415-f06d-4ab3-9e9c-db0cb100a5a8','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  begin
    update public.profiles set level_auto_advance_enabled = false
      where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  exception when others then
    blocked := true;
  end;
  reset role;

  if not blocked then
    raise exception 'FEJL TEST5: barnets session kunne ændre level_auto_advance_enabled!';
  end if;

  select level_auto_advance_enabled into v_flag from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_flag is distinct from true then
    raise exception 'FEJL TEST5b: level_auto_advance_enabled blev alligevel ændret til %', v_flag;
  end if;
  raise notice 'TEST 5 OK: barnets session kan ikke ændre level_auto_advance_enabled';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 6: fremmed forælder rammer 0 rækker (RLS filtrerer, ingen fejl).
do $$
declare
  v_goal integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','e0b8c5a6-374a-424a-8b09-044d3f3ddab5','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  update public.profiles set daily_goal_lessons = 5
    where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'; -- Ali tilhører den ANDEN forælder
  reset role;

  select daily_goal_lessons into v_goal from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_goal <> 1 then
    raise exception 'FEJL TEST6: fremmed forælder kunne ændre Alis daily_goal_lessons, fik %', v_goal;
  end if;
  raise notice 'TEST 6 OK: fremmed forælder har 0 effekt på Alis profil';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 7: record_progress (SECURITY DEFINER, postgres-undtagelsen) kan
-- STADIG skrive streak_count/last_active_day efter triggerens udvidelse.
do $$
declare
  v_lesson_id uuid;
  v_last_after date;
begin
  select id into v_lesson_id from public.lessons where world = 'bogstavernes_dal' order by order_index limit 1;
  if v_lesson_id is null then
    raise exception 'TEST7-FORUDSÆTNING: ingen lektion fundet i bogstavernes_dal';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  perform public.record_progress(gen_random_uuid(), 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, v_lesson_id, 5, 0, false, null);
  reset role;

  select last_active_day into v_last_after from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_last_after is distinct from current_date then
    raise exception 'FEJL TEST7 (REGRESSION): record_progress kunne ikke længere sætte last_active_day, fik %', v_last_after;
  end if;
  raise notice 'TEST 7 OK: record_progress kan stadig skrive streak/last_active_day (postgres-undtagelsen intakt)';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 8: fuld mestring af ALT niveau-1-indhold rykker automatisk Ali fra
-- niveau 1 til 2 (kalder record_item_stat gentagne gange, som spillene gør).
do $$
declare
  v_before integer;
  v_after integer;
  v_id uuid;
begin
  select current_level into v_before from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_before <> 1 then
    raise exception 'TEST8-FORUDSÆTNING: Ali er ikke på niveau 1 (er %) — testen forudsætter dette', v_before;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated','user_role','admin')::text, true);
  set local role authenticated;

  for v_id in select id from public.letters where level = 1 loop
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
  end loop;

  for v_id in select id from public.vocabulary where level = 1 and is_published = true loop
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'vocabulary', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'vocabulary', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'vocabulary', v_id, true);
  end loop;

  reset role;

  select current_level into v_after from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_after <> 2 then
    raise exception 'FEJL TEST8: fuld mestring på niveau 1 rykkede IKKE Ali til niveau 2, endte på %', v_after;
  end if;
  raise notice 'TEST 8 OK: fuld mestring rykker automatisk niveauet fra 1 til 2';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 9: DELVIS mestring (kun 5 ud af 28 bogstaver, ingen ord) rykker
-- IKKE niveauet — beviser at tærsklen rent faktisk gater noget.
do $$
declare
  v_after integer;
  v_id uuid;
  v_count integer := 0;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated','user_role','admin')::text, true);
  set local role authenticated;

  for v_id in select id from public.letters where level = 1 order by position limit 5 loop
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    v_count := v_count + 1;
  end loop;

  reset role;

  select current_level into v_after from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_after <> 1 then
    raise exception 'FEJL TEST9: delvis mestring (% bogstaver) rykkede alligevel niveauet til %', v_count, v_after;
  end if;
  raise notice 'TEST 9 OK: delvis mestring (5 af 28 bogstaver) rykker ikke niveauet';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 10: level_auto_advance_enabled = false blokerer fremgangen HELT,
-- selv ved fuld mestring — beviser at "forælder kan overstyre" er reelt.
do $$
declare
  v_after integer;
  v_id uuid;
begin
  update public.profiles set level_auto_advance_enabled = false
    where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role','authenticated','user_role','admin')::text, true);
  set local role authenticated;

  for v_id in select id from public.letters where level = 1 loop
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'letter', v_id, true);
  end loop;
  for v_id in select id from public.vocabulary where level = 1 and is_published = true loop
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'vocabulary', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'vocabulary', v_id, true);
    perform public.record_item_stat('b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42'::uuid, 'vocabulary', v_id, true);
  end loop;

  reset role;

  select current_level into v_after from public.profiles where id = 'b1bc21cd-3ff7-4d95-8b4b-fe9db5b1db42';
  if v_after <> 1 then
    raise exception 'FEJL TEST10: level_auto_advance_enabled=false blokerede IKKE fremgangen, endte på %', v_after;
  end if;
  raise notice 'TEST 10 OK: level_auto_advance_enabled=false forhindrer automatisk fremgang selv ved fuld mestring (forælderens overstyring er reel)';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Ejer-valgt engangs-oprykning: de 3 eksisterende profiler fra niveau 1
--    til niveau 2. Kører EFTER alle tests, så testene så den ægte
--    "alle på 1"-tilstand. Idempotent i praksis (rammer kun rækker der
--    faktisk står på 1).
-- ---------------------------------------------------------------------------
update public.profiles
  set current_level = 2
  where current_level = 1;
