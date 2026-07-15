-- ============================================================================
-- fase1_matchpar_emoji_lesson — Match-par (tredje kernespil)
-- ============================================================================
-- 1. vocabulary.emoji: emoji der bærer ordets betydning for 3–6-skindet
--    (ingen læsekrav). Kun visuel fallback — et rigtigt billede
--    (image_media_id) vinder altid over emojien i UI'et.
-- 2. Emoji-seed for de eksisterende 54 ord, matchet på transliteration
--    (unik og stabil). Idempotent: opdaterer kun rækker uden emoji.
-- 3. Lesson-række 'Match-par' (order_index 3) til progress/XP.
--
-- MUREN: rører kun vocabulary/lessons (Bogstavernes Dal, AI-tilladt).
-- Ingen aqidah-, letters- eller media-berøring. RLS uændret — den nye
-- kolonne arver tabellens eksisterende politikker (offentlig læsning,
-- skrivning kun admin/editor, ai_service nul adgang).
-- ============================================================================

alter table vocabulary add column if not exists emoji text;

comment on column vocabulary.emoji is
  'Emoji som visuel betydningsbærer for 3-6-skindet (ingen læsekrav). '
  'Fallback: image_media_id vinder altid over emoji i UI. Nullable — '
  'ord uden emoji viser blot det danske ord.';

-- ----------------------------------------------------------------------------
-- Emoji-seed (kun rækker der endnu ikke har en emoji)
-- ----------------------------------------------------------------------------

update vocabulary v
set emoji = e.emoji
from (
  values
    -- dyr
    ('samaka',     '🐟'),
    ('''usfuur',   '🐦'),
    ('kalb',       '🐶'),
    ('jamal',      '🐪'),
    ('qitt',       '🐱'),
    ('asad',       '🦁'),
    -- familie
    ('jadd',       '👴'),
    ('jadda',      '👵'),
    ('akh',        '👦'),
    ('ab',         '👨'),
    ('umm',        '👩'),
    ('ukht',       '👧'),
    -- farver
    ('azraq',      '🔵'),
    ('akhdar',     '🟢'),
    ('asfar',      '🟡'),
    ('abyad',      '⚪'),
    ('ahmar',      '🔴'),
    ('aswad',      '⚫'),
    -- hilsner
    ('salaam',     '👋'),
    ('na''am',     '👍'),
    ('laa',        '👎'),
    ('shukran',    '🙏'),
    -- hjem
    ('qalam',      '✏️'),
    ('kitaab',     '📖'),
    ('baab',       '🚪'),
    ('bayt',       '🏠'),
    -- krop
    ('qadam',      '🦶'),
    ('yad',        '✋'),
    ('fam',        '👄'),
    ('anf',        '👃'),
    ('''ayn',      '👁️'),
    -- mad
    ('tuffaaha',   '🍎'),
    ('mawz',       '🍌'),
    ('khubz',      '🍞'),
    ('tamr',       '🌴'),
    ('haliib',     '🥛'),
    ('maa''',      '💧'),
    -- natur
    ('warda',      '🌸'),
    ('bahr',       '🌊'),
    ('nuur',       '✨'),
    ('qamar',      '🌙'),
    ('shams',      '☀️'),
    ('najma',      '⭐'),
    ('shajara',    '🌳'),
    -- tal
    ('waahid',     '1️⃣'),
    ('ithnaan',    '2️⃣'),
    ('thalaatha',  '3️⃣'),
    ('arba''a',    '4️⃣'),
    ('khamsa',     '5️⃣'),
    ('sitta',      '6️⃣'),
    ('sab''a',     '7️⃣'),
    ('thamaaniya', '8️⃣'),
    ('tis''a',     '9️⃣'),
    ('''ashara',   '🔟')
) as e(translit, emoji)
where v.transliteration = e.translit
  and v.emoji is null;

-- ----------------------------------------------------------------------------
-- Lesson-række til Match-par (idempotent)
-- ----------------------------------------------------------------------------

insert into lessons (world, order_index, title_da, title_ar, content_ids, is_published)
select 'bogstavernes_dal', 3, 'Match-par', 'مُطَابَقَة', '{}', true
where not exists (
  select 1 from lessons
  where world = 'bogstavernes_dal' and title_da = 'Match-par'
);
