-- ============================================================================
-- Ordforråds-værkstedet, Leverance A (2026-07-20)
-- Proveniens på vocabulary + mur-regel: AI-forslag fødes ALTID som kladde.
--
-- Anvendt på live-DB via MCP 2026-07-20 og verificeret med mur-stil
-- regressionstest (DO $$-blok, ROLLBACK_MARKER, 0 rækker efterladt):
--   TEST 1: insert suggested_by='ai' + is_published=true  → AFVIST ✓
--   TEST 2: insert suggested_by='ai' + is_published=false → accepteret ✓
--   TEST 3: menneskelig udgivelse via separat UPDATE      → accepteret ✓
--   TEST 4: ugyldig suggested_by ('robot')                → AFVIST ✓
--   TEST 5: alle eksisterende rækker fik default 'human'  ✓
--
-- Dublet-værn (ejer-krav) håndhæves i tre lag; denne migration er lag 3's
-- fundament sammen med den eksisterende vocabulary_word_ar_key (UNIQUE).
-- Lag 1: Edge Function suggest-vocab (prompt-undgåelse + normaliseret
-- efter-filtrering). Lag 2: klientens engine.ts (isDuplicateWord).
-- ============================================================================

-- 1) suggested_by-kolonne: 'human' (default) eller 'ai'
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vocabulary'
      and column_name = 'suggested_by'
  ) then
    alter table public.vocabulary
      add column suggested_by text not null default 'human';
  end if;
end $$;

-- 2) CHECK-constraint på tilladte værdier
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vocabulary_suggested_by_check'
      and conrelid = 'public.vocabulary'::regclass
  ) then
    alter table public.vocabulary
      add constraint vocabulary_suggested_by_check
      check (suggested_by in ('human', 'ai'));
  end if;
end $$;

-- 3) Mur-trigger: et AI-foreslået ord kan aldrig INSERTes som udgivet.
-- Udgivelse af en AI-kladde skal være en separat, menneskelig UPDATE
-- (beskyttet af eksisterende admin/editor-RLS). Fail-closed ved insert.
create or replace function public.enforce_vocab_ai_draft_only()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.suggested_by = 'ai' and new.is_published = true then
    raise exception 'AI-suggested vocabulary must be inserted as draft (is_published = false)';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_vocab_ai_draft_only'
      and tgrelid = 'public.vocabulary'::regclass
  ) then
    create trigger trg_vocab_ai_draft_only
      before insert on public.vocabulary
      for each row
      execute function public.enforce_vocab_ai_draft_only();
  end if;
end $$;
