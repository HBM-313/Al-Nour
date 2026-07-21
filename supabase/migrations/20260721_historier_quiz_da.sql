-- ============================================================================
-- Historiernes Bjerge: "hvad husker du"-quiz på aqidah-fortællinger
-- (ejer-beslutning 2026-07-21). Rent datafelt på content — INGEN ny
-- RLS-politik, INGEN ny trigger-logik. Aqidah-muren (RLS +
-- enforce_aqidah_wall) opererer på RÆKKE-niveau og dækker derfor
-- automatisk denne kolonne: ai_service kan stadig aldrig skrive til en
-- aqidah-række uanset hvilken kolonne der røres (Lag A), og redaktør/
-- godkender-adgangen til quiz_da følger nøjagtig samme regler som resten
-- af rækken (kladde vs. verificeret/udgivet).
--
-- quiz_da: jsonb, nullable. Aftalt struktur (håndhæves kun som "skal være
-- et array" i DB, resten er TypeScript-siden — se lib/types.ts):
--   [{ "question_da": "...", "options": [{ "text_da": "...", "correct": bool }] }]
--
-- Forfatterskab (ejer-beslutning 2026-07-21): spørgsmålene er IKKE et
-- separat AI-tilladt indholdsfelt — de lever på samme aqidah-række og er
-- derfor underlagt samme mur som body_da. Claude må foreslå ordlyd i
-- chatten, men en redaktør/godkender indtaster og godkender den endelige
-- tekst i historie-værkstedet, ligesom resten af fortællingen — ingen
-- live AI-vej rører nogensinde denne kolonne (i modsætning til Ordforråds-
-- værkstedets suggest-vocab, som er en separat, kun-forslag Edge Function
-- for ai_allowed-indhold).
--
-- Verificeret med rollback-markør-regressionstest mod live-DB (session
-- 2026-07-21): ai_service kan ikke skrive quiz_da til en aqidah-række ✓,
-- redaktør kan skrive/redigere quiz_da på egen uverificeret kladde ✓,
-- ugyldig (ikke-array) quiz_da afvises af check-constraint ✓. 0 rækker
-- efterladt.
-- ============================================================================

alter table public.content
  add column if not exists quiz_da jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_quiz_da_is_array' and conrelid = 'public.content'::regclass
  ) then
    alter table public.content
      add constraint content_quiz_da_is_array
      check (quiz_da is null or jsonb_typeof(quiz_da) = 'array');
  end if;
end $$;
