-- Leverance D4 (plan-boernesession-og-dashboard.md §6.5): forælderens egne
-- ord — familiens navne, maden de spiser, ordene bedstemor bruger. VIGTIGT:
-- disse ord går ALDRIG ind i `vocabulary` (admin/editor-only, globalt
-- indhold, del af den godkendte katalog-mur) — egen tabel, ejet af
-- FORÆLDERENS konto (ordene er familiens, ikke ét barns), RLS-afgrænset,
-- aldrig synlig for andre familier.
--
-- EJER-BESLUTNING (denne session): ordene skal kunne indgå i spillene
-- (Match-par/Lyt & Find) som almindeligt spilindhold, ikke kun en liste
-- forælderen læser højt uden for spillene. Derfor får tabellen samme form
-- som `vocabulary` (category/level/register/first_letter_id/emoji/
-- audio+image-medier), så et custom_words-ord kan mappes 1:1 til
-- VocabularyWord-formen på klienten og blandes ind i spillenes ordpuljer
-- uden at røre engine.ts-logikken (pickRoundWords/buildDeck/isMatch
-- kender kun formen, ikke kilden).
--
-- BEVIDST SCOPE-GRÆNSE (v1, dokumenteret her så den ikke er tilfældig):
-- item-statistik (D1/record_item_stat) for custom-ord skrives med
-- item_type='vocabulary' ligesom rigtige vocabulary-ord — INGEN ny
-- item_type, INGEN ændring af record_item_stat/evaluate_level_advance.
-- Det er harmløst: der er ingen FK fra profile_item_stats.item_id til
-- vocabulary(id), og evaluate_level_advance/dashboardets læringstal joiner
-- eksplicit mod `vocabulary`-tabellen — et custom_words-id matcher aldrig
-- en række dér, så tællerne for custom-ord bidrager hverken til "kendte
-- ord X af 107" eller til automatisk niveau-fremgang. De er med andre ord
-- usynlige for D2/D3.1 lige nu, ikke forkert talt med. Skal familieordenes
-- egne læringstal ("her kæmper barnet med jeres ord") vises i dashboardet
-- senere, er det en ren udvidelse (ny item_type + dashboard-gren) — ikke en
-- omskrivning af det der bygges her.

create table if not exists public.custom_words (
  id uuid primary key default gen_random_uuid(),
  -- Familiens konto — IKKE et barns profil-id. Ordene tilhører familien,
  -- ses af alle børn i familien (se child-select-policyen nedenfor).
  account_id uuid not null references public.accounts(id) on delete cascade,
  word_ar text not null,
  transliteration text not null,
  word_da text not null,
  -- Samme 9 kategorier som vocabulary (VocabularyCategory på klienten) —
  -- ingen CHECK her, ligesom vocabulary.category; enum'et håndhæves i TS
  -- og af det dropdown der genbruges fra vokab-vaerksted.
  category text not null,
  register text not null default 'everyday' check (register in ('fusha', 'everyday')),
  level integer not null default 1 check (level between 1 and 4),
  first_letter_id uuid references public.letters(id),
  emoji text,
  image_media_id uuid references public.media(id),
  -- Kvindestemme (standard/fallback) — samme lyd-vej (Google Cloud TTS)
  audio_media_id uuid references public.media(id),
  -- Mandsstemme — valgt når barnets stemmepræference er 'male'
  audio_media_id_male uuid references public.media(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.custom_words is
  'Familiens egne ord (plan §6.5) — navne, mad, hverdagsord forælderen '
  'tilføjer. AI-tilladt-kategori (ingen teologiske fakta), men ALDRIG i '
  '`vocabulary` (godkendt katalog-mur). Ejet af account_id (forælderens '
  'konto), synlig for hele familien inkl. børnenes sessioner, aldrig for '
  'andre familier. Kan indgå i Match-par/Lyt & Find på samme vilkår som '
  'vocabulary (samme form, mappes til VocabularyWord på klienten).';

create index if not exists custom_words_account_id_idx on public.custom_words (account_id);

alter table public.custom_words enable row level security;

-- Forælder (ejer af kontoen) og admin: fuld CRUD på egne/alle rækker.
drop policy if exists custom_words_owner_all on public.custom_words;
create policy custom_words_owner_all on public.custom_words
  for all
  using (account_id = auth.uid() or auth_user_role() = 'admin')
  with check (account_id = auth.uid() or auth_user_role() = 'admin');

-- Barnets session: kun læsning, kun egen families ord (bundet via
-- profiles.auth_user_id = auth.uid(), samme stærke konstruktion som
-- profile_item_stats_child_select_own — IKKE et klient-styret claim).
-- Intet barn kan skrive/rette/slette familiens ordliste.
drop policy if exists custom_words_child_select_own on public.custom_words;
create policy custom_words_child_select_own on public.custom_words
  for select
  using (
    auth_user_role() = 'child'
    and exists (
      select 1 from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.owner_account_id = custom_words.account_id
    )
  );

-- ai_service: ingen policy, intet grant → fail-closed som resten af muren
-- (ai_service har kun eksplicitte grants på content/characters/lessons/
-- media — custom_words er persondata, ikke AI-genereringsindhold).

drop trigger if exists trg_custom_words_updated_at on public.custom_words;
create trigger trg_custom_words_updated_at
  before update on public.custom_words
  for each row execute function public.set_updated_at();

-- ============================================================
-- REGRESSIONSTESTS (mur-stil: DO-blokke, rollback-markør, 0 rækker
-- efterladt — hvert blok ruller sig selv tilbage). Fejler én test, fejler
-- HELE migrationen (ingenting af denne fil anvendes).
--
-- Testdata (samme som D3.1): test-forælder 8ace1757-72c6-4ff0-ba19-
-- 9dc4f52e5007 ejer Ali (auth_user_id 2ea57415-f06d-4ab3-9e9c-
-- db0cb100a5a8) og Zainab. Ejerens admin-konto e0b8c5a6-374a-424a-8b09-
-- 044d3f3ddab5 ejer Hassan (auth_user_id dc9679f8-2c79-4a35-8368-
-- 4485362d8302) og bruges også som "fremmed forælder" (spoofet
-- user_role='parent'-claim, samme mønster som D3.1 test 6) i test 4-5.
-- ============================================================

-- TEST 1: forælder kan INSERT + SELECT eget custom-ord.
do $$
declare
  v_id uuid;
  v_word text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'بَاب', 'bab', 'dør', 'hjem', 1)
    returning id into v_id;
  select word_da into v_word from public.custom_words where id = v_id;
  reset role;

  if v_word is distinct from 'dør' then
    raise exception 'FEJL TEST1: forælder kunne ikke indsætte/læse eget custom-ord, fik %', v_word;
  end if;
  raise notice 'TEST 1 OK: forælder kan indsætte og læse eget custom-ord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 2: forælder kan UPDATE eget custom-ord.
do $$
declare
  v_id uuid;
  v_word text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'تُفَّاح', 'tuffah', 'æble', 'mad', 1)
    returning id into v_id;
  update public.custom_words set word_da = 'æblejuice' where id = v_id;
  select word_da into v_word from public.custom_words where id = v_id;
  reset role;

  if v_word is distinct from 'æblejuice' then
    raise exception 'FEJL TEST2: forælder kunne ikke opdatere eget custom-ord, fik %', v_word;
  end if;
  raise notice 'TEST 2 OK: forælder kan opdatere eget custom-ord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 3: forælder kan DELETE eget custom-ord.
do $$
declare
  v_id uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'جَدَّة', 'jadda', 'bedstemor', 'familie', 1)
    returning id into v_id;
  delete from public.custom_words where id = v_id;
  select count(*) into v_count from public.custom_words where id = v_id;
  reset role;

  if v_count <> 0 then
    raise exception 'FEJL TEST3: forælder kunne ikke slette eget custom-ord';
  end if;
  raise notice 'TEST 3 OK: forælder kan slette eget custom-ord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 4: fremmed forælder kan IKKE indsætte et ord under en andens
-- account_id (WITH CHECK blokerer).
do $$
declare
  blocked boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','e0b8c5a6-374a-424a-8b09-044d3f3ddab5','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  begin
    insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
      values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'قِطَّة', 'qitta', 'kat', 'dyr', 1);
  exception when others then
    blocked := true;
  end;
  reset role;

  if not blocked then
    raise exception 'FEJL TEST4: fremmed forælder kunne indsætte ord under en andens konto!';
  end if;
  raise notice 'TEST 4 OK: fremmed forælder blokeres fra at indsætte under andens konto';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 5: fremmed forælder ser 0 rækker af en andens familieord.
do $$
declare
  v_id uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'شَجَرَة', 'shajara', 'træ', 'natur', 1)
    returning id into v_id;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub','e0b8c5a6-374a-424a-8b09-044d3f3ddab5','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.custom_words where id = v_id;
  reset role;

  if v_count <> 0 then
    raise exception 'FEJL TEST5: fremmed forælder kunne se en andens familieord!';
  end if;
  raise notice 'TEST 5 OK: fremmed forælder ser 0 rækker af en andens familieord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 6: Alis (barn, familie 8ace1757) session KAN se familiens ord.
do $$
declare
  v_id uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'حَلِيب', 'halib', 'mælk', 'mad', 1)
    returning id into v_id;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub','2ea57415-f06d-4ab3-9e9c-db0cb100a5a8','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.custom_words where id = v_id;
  reset role;

  if v_count <> 1 then
    raise exception 'FEJL TEST6: Alis session kunne ikke se familiens custom-ord, fik % rækker', v_count;
  end if;
  raise notice 'TEST 6 OK: Alis session ser familiens custom-ord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 7: Alis session kan IKKE skrive (kun læsning for børn).
do $$
declare
  blocked boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','2ea57415-f06d-4ab3-9e9c-db0cb100a5a8','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  begin
    insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
      values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'سَيَّارَة', 'sayyara', 'bil', 'hjem', 1);
  exception when others then
    blocked := true;
  end;
  reset role;

  if not blocked then
    raise exception 'FEJL TEST7: Alis (barne-)session kunne indsætte et custom-ord!';
  end if;
  raise notice 'TEST 7 OK: barnets session kan ikke skrive custom_words (kun læsning)';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 8: Hassans (barn, ANDEN familie: e0b8c5a6) session ser 0 rækker af
-- Alis families ord.
do $$
declare
  v_id uuid;
  v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'وَرْدَة', 'warda', 'rose', 'natur', 1)
    returning id into v_id;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub','dc9679f8-2c79-4a35-8368-4485362d8302','role','authenticated','user_role','child')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.custom_words where id = v_id;
  reset role;

  if v_count <> 0 then
    raise exception 'FEJL TEST8: Hassans session (anden familie) kunne se Alis families ord!';
  end if;
  raise notice 'TEST 8 OK: Hassans session ser 0 rækker af en anden families custom-ord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 9: admin kan se/rette/slette enhver families custom-ord.
do $$
declare
  v_id uuid;
  v_word text;
  v_count integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','8ace1757-72c6-4ff0-ba19-9dc4f52e5007','role','authenticated','user_role','parent')::text, true);
  set local role authenticated;
  insert into public.custom_words (account_id, word_ar, transliteration, word_da, category, level)
    values ('8ace1757-72c6-4ff0-ba19-9dc4f52e5007', 'نَجْمَة', 'najma', 'stjerne', 'natur', 1)
    returning id into v_id;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub','e0b8c5a6-374a-424a-8b09-044d3f3ddab5','role','authenticated','user_role','admin')::text, true);
  set local role authenticated;
  update public.custom_words set word_da = 'stjerneskud' where id = v_id;
  select word_da into v_word from public.custom_words where id = v_id;
  delete from public.custom_words where id = v_id;
  select count(*) into v_count from public.custom_words where id = v_id;
  reset role;

  if v_word is distinct from 'stjerneskud' or v_count <> 0 then
    raise exception 'FEJL TEST9: admin kunne ikke rette/slette en andens families custom-ord (word=%, count=%)', v_word, v_count;
  end if;
  raise notice 'TEST 9 OK: admin kan rette og slette enhver families custom-ord';

  raise exception 'ROLLBACK_MARKER';
exception
  when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then raise; end if;
end $$;

-- TEST 10: ai_service Postgres-rollen har 0 tabel-privilegier på
-- custom_words (intet GRANT nogensinde givet — fail-closed allerede før
-- RLS evalueres). `has_table_privilege` bruges i stedet for `set local
-- role ai_service`, da MCP-forbindelsens rolle ikke har medlemskab af
-- ai_service (nologin-rolle) og derfor ikke må skifte til den direkte.
do $$
declare
  can_select boolean;
  can_insert boolean;
  can_update boolean;
  can_delete boolean;
begin
  select has_table_privilege('ai_service', 'public.custom_words', 'SELECT') into can_select;
  select has_table_privilege('ai_service', 'public.custom_words', 'INSERT') into can_insert;
  select has_table_privilege('ai_service', 'public.custom_words', 'UPDATE') into can_update;
  select has_table_privilege('ai_service', 'public.custom_words', 'DELETE') into can_delete;

  if can_select or can_insert or can_update or can_delete then
    raise exception 'FEJL TEST10: ai_service har privilegier på custom_words (select=%, insert=%, update=%, delete=%)',
      can_select, can_insert, can_update, can_delete;
  end if;
  raise notice 'TEST 10 OK: ai_service har 0 tabel-privilegier på custom_words';
end $$;

-- Alle 10 tests bestået og rullet tilbage (test 1-9 via ROLLBACK_MARKER,
-- test 10 skriver aldrig noget) → 0 rækker efterladt af testkørslen.
