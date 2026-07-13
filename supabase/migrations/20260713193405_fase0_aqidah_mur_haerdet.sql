-- ============================================================================
-- Konsolideret hærdning af aqidah-muren (spejler deployeret tilstand)
-- ============================================================================
-- Deployeret som fire migrationer 2026-07-13 (fase0_luk_aqidah_mur_huller,
-- _jwt_foerst, _security_invoker, _null_semantik). Denne fil er den samlede
-- slut-tilstand, så repoet matcher databasen.
--
-- Fundne og lukkede huller (alle bevist ved test mod live-instansen):
--   1. FAIL-OPEN: "if jwt_role is not null and ... not in" slap claim-løse
--      sessioner (service_role!) igennem til aqidah-udgivelse.
--   2. SECURITY DEFINER: current_user var altid funktions-ejeren (postgres)
--      inde i triggeren, så ai_service/service_role-checks målte forkert.
--   3. NULL-SEMANTIK: "jwt_role in (...)" er NULL når jwt_role er NULL;
--      "if not NULL" udføres ikke → fail-open igen. Løst med coalesce.
--   4. ai_service havde UPDATE-policy+grant på content (planen: kun insert
--      af nye kladder) og kunne læse ikke-udgivet aqidah.
--
-- Verificerede tests efter fix:
--   editor-claim udgiver aqidah          → AFVIST ✓
--   service_role uden claim               → AFVIST ✓
--   approver-claim udgiver aqidah         → TILLADT ✓
--   approver uden is_source_verified      → AFVIST ✓
--   editor omklassificerer til aqidah     → AFVIST ✓
-- ============================================================================

create or replace function enforce_aqidah_wall()
returns trigger
language plpgsql
security invoker  -- IKKE definer: current_user skal være den kaldende rolle
set search_path = public
as $$
declare
  jwt_role text;
  allowed boolean;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'user_role', null);

  -- coalesce er kritisk: NULL-claim må aldrig give NULL-allowed (fail-open).
  allowed := coalesce(
    (jwt_role in ('approver', 'admin'))
    or (jwt_role is null and current_user = 'postgres'),
    false
  );

  -- Lag A: ai_service må ALDRIG røre en aqidah-række.
  if current_user = 'ai_service' and new.content_type = 'aqidah' then
    raise exception 'AQIDAH_WALL: ai_service-rollen har ingen adgang til aqidah-indhold. Aqidah leveres og godkendes af mennesker.';
  end if;

  -- Lag B: udgivelse af aqidah — fail closed.
  if new.content_type = 'aqidah' and new.is_published = true then
    if new.source_reference is null or length(trim(new.source_reference)) = 0 then
      raise exception 'AQIDAH_WALL: aqidah kan ikke udgives uden source_reference.';
    end if;
    if new.is_source_verified is not true then
      raise exception 'AQIDAH_WALL: aqidah kan ikke udgives uden is_source_verified = true.';
    end if;
    if not allowed then
      raise exception 'AQIDAH_WALL: kun godkender eller admin kan udgive aqidah-indhold (rolle: %, bruger: %).',
        coalesce(jwt_role, 'ingen'), current_user;
    end if;
  end if;

  -- Lag C: omklassificering til/fra aqidah — fail closed.
  if tg_op = 'UPDATE' and old.content_type is distinct from new.content_type then
    if not allowed then
      raise exception 'AQIDAH_WALL: kun godkender eller admin kan ændre content_type (rolle: %, bruger: %).',
        coalesce(jwt_role, 'ingen'), current_user;
    end if;
  end if;

  return new;
end;
$$;

-- ai_service: fjern update-adgang; læsning kun af ai_allowed
drop policy if exists content_ai_service_update on content;
revoke update on content from ai_service;

drop policy if exists content_ai_service_read on content;
create policy content_ai_service_read on content
  for select
  to ai_service
  using (content_type = 'ai_allowed');
