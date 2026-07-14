-- ============================================================================
-- fase1_lydregel_lempet — EJER-BESLUTNING 2026-07-14
-- ============================================================================
-- Ny lyd-regel (erstatter den gamle "kerne-fusha = human-only"):
--
--   AL lyd i projektet må være TTS/AI-genereret eller uploadet fil,
--   og kan frit udskiftes senere (fx ElevenLabs, Google, egen optagelse).
--   DEN ENESTE UNDTAGELSE: Quran-recitation skal være menneskelig.
--
-- Quran-muren består uændret og håndhæves af:
--   media_ai_never_recitation  (CHECK: generated_by='ai' → is_recitation=false)
--
-- Denne migration:
--   1. Fjerner trg_letters_audio_human (afviste AI-lyd på bogstaver).
--   2. Erstatter den med trg_letters_audio_valid, som stadig er fail-closed
--      på ukendte medier, og som afviser recitation-markeret lyd på bogstaver
--      (bogstavlyd er udtale — recitation hører til Quran-indhold, fase 2).
--   3. Opdaterer tabel-kommentaren så næste session ikke "retter" det tilbage.
--
-- NB: Dette er en BEVIDST lempelse, ikke drift. Skal ikke rulles tilbage.
-- ============================================================================

drop trigger if exists trg_letters_audio_human on letters;
drop function if exists enforce_letter_audio_human();

create or replace function enforce_letter_audio_valid()
returns trigger
language plpgsql
security definer            -- skal altid kunne læse media; checker IKKE current_user
set search_path = public
as $$
declare
  m record;
begin
  if new.audio_media_id is not null then
    select generated_by, is_recitation into m
    from media where id = new.audio_media_id;

    -- Fail-closed: ukendt medie afvises (FK fanger det også, men vi vil
    -- have en forståelig fejlbesked frem for en rå FK-violation).
    if not found then
      raise exception 'LYD: audio_media_id peger på et medie der ikke findes (fail-closed)';
    end if;

    -- Quran-muren i praksis: bogstavlyd er UDTALE og må aldrig være
    -- recitation-markeret. Recitation lever kun på Quran-indhold (fase 2)
    -- og skal dér være menneskelig (media_ai_never_recitation).
    if m.is_recitation then
      raise exception 'LYD: recitation-markeret lyd kan ikke bruges som bogstavlyd';
    end if;
    -- generated_by tjekkes IKKE længere: human, ai og TTS er alle tilladt.
  end if;
  return new;
end;
$$;

create trigger trg_letters_audio_valid before insert or update on letters
  for each row execute function enforce_letter_audio_valid();

comment on table letters is
  'De 28 arabiske bogstaver. Former genereres via tatweel af letter+is_connector. '
  'LYD-REGEL (ejer-beslutning 2026-07-14): bogstavlyd må være TTS/AI eller uploadet '
  'fil og kan frit udskiftes. Kun Quran-recitation skal være menneskelig '
  '(media_ai_never_recitation). Bogstavlyd må aldrig være recitation-markeret '
  '(trg_letters_audio_valid, fail-closed på ukendte medier).';
