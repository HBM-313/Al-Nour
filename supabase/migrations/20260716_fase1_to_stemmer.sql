-- ============================================================================
-- fase1_to_stemmer — kvinde- og mandsstemme pr. bogstav/ord (ejer-beslutning)
-- ============================================================================
-- To lydspor pr. element: audio_media_id (kvindestemme, Habibah — også
-- fallback/standard) + audio_media_id_male (mandsstemme, Ahmed). Appen
-- vælger efter barnets valg/profil: pige → kvindestemme, dreng →
-- mandsstemme. Mangler det ene spor, bruges det andet (fail-soft i app).
--
-- LYD-MUREN udvides tilsvarende: trg_letters_audio_valid validerer nu
-- BEGGE kolonner med samme regler (medie skal findes; recitation-markeret
-- lyd kan aldrig være bogstavlyd). Quran-muren (media_ai_never_recitation)
-- er urørt og gælder fortsat alle media-rækker.
-- ============================================================================

-- 1. Kolonner (idempotent)
alter table letters
  add column if not exists audio_media_id_male uuid references media(id);
alter table vocabulary
  add column if not exists audio_media_id_male uuid references media(id);

comment on column letters.audio_media_id is
  'Kvindestemme (standard/fallback). Se audio_media_id_male for mandsstemme.';
comment on column letters.audio_media_id_male is
  'Mandsstemme. Valideres af trg_letters_audio_valid som kvindesporet.';
comment on column vocabulary.audio_media_id_male is
  'Mandsstemme. audio_media_id er kvindestemme (standard/fallback).';

-- 2. Lyd-muren: valider begge spor (samme fail-closed regler)
create or replace function public.enforce_letter_audio_valid()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m record;
begin
  if new.audio_media_id is not null then
    select generated_by, is_recitation into m
    from media where id = new.audio_media_id;

    if not found then
      raise exception 'LYD: audio_media_id peger på et medie der ikke findes (fail-closed)';
    end if;

    if m.is_recitation then
      raise exception 'LYD: recitation-markeret lyd kan ikke bruges som bogstavlyd';
    end if;
  end if;

  if new.audio_media_id_male is not null then
    select generated_by, is_recitation into m
    from media where id = new.audio_media_id_male;

    if not found then
      raise exception 'LYD: audio_media_id_male peger på et medie der ikke findes (fail-closed)';
    end if;

    if m.is_recitation then
      raise exception 'LYD: recitation-markeret lyd kan ikke bruges som bogstavlyd';
    end if;
  end if;

  return new;
end;
$function$;
