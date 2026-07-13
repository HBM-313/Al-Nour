-- ============================================================================
-- Nour — Fase 0: Aqidah-mur trigger (forsvar i dybden)
-- ============================================================================
-- RLS (0002) er det primære forsvar. Denne trigger er et UAFHÆNGIGT andet
-- lag: selv hvis en fremtidig migration ved en fejl introducerer en for bred
-- RLS-policy, eller nogen kalder tabellen med SECURITY DEFINER-omgåelse,
-- fanger denne trigger stadig ethvert forsøg på at:
--   1) indsætte/redigere en aqidah-række som ai_service
--   2) sætte content_type='aqidah' fra en session der ikke er approver/admin
--   3) udgive aqidah uden kilde-verifikation
-- ============================================================================

create or replace function enforce_aqidah_wall()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role text;
  acting_account_role account_role;
begin
  acting_role := current_user;

  -- Lag A: ai_service må ALDRIG røre en aqidah-række, uanset RLS-tilstand.
  if acting_role = 'ai_service' and (new.content_type = 'aqidah') then
    raise exception 'AQIDAH_WALL: ai_service-rollen har ingen adgang til aqidah-indhold. '
      'Aqidah skal indtastes og godkendes af et menneske (approver/admin).';
  end if;

  -- Hvis en eksisterende ai_allowed-række forsøges konverteret til aqidah,
  -- eller omvendt, kræver det eksplicit approver/admin — content_type må
  -- aldrig skifte "stille" via en generel opdatering.
  if tg_op = 'UPDATE' and old.content_type <> new.content_type then
    select role into acting_account_role
    from accounts
    where auth_user_id = auth.uid();

    if acting_account_role is null or acting_account_role not in ('admin', 'approver') then
      raise exception 'AQIDAH_WALL: skift af content_type kræver approver- eller admin-rolle.';
    end if;
  end if;

  -- Lag B: aqidah må kun udgives af approver/admin, og kun når kilde-verificeret.
  if new.content_type = 'aqidah' and new.is_published = true then
    select role into acting_account_role
    from accounts
    where auth_user_id = auth.uid();

    if acting_account_role is null or acting_account_role not in ('admin', 'approver') then
      raise exception 'AQIDAH_WALL: kun godkender eller admin kan udgive aqidah-indhold.';
    end if;

    if new.is_source_verified is distinct from true then
      raise exception 'AQIDAH_WALL: aqidah kan ikke udgives uden is_source_verified = true.';
    end if;

    if new.source_reference is null or length(trim(new.source_reference)) = 0 then
      raise exception 'AQIDAH_WALL: aqidah kræver en udfyldt source_reference.';
    end if;

    -- Sæt published_by/published_at automatisk ved første udgivelse.
    if tg_op = 'INSERT' or old.is_published = false then
      new.published_by := current_account_id();
      new.published_at := now();
    end if;
  end if;

  -- Lag C: aqidah skal altid repræsentere de hellige som lys, aldrig andet.
  if new.content_type = 'aqidah' and new.sacred_representation <> 'light' then
    raise exception 'AQIDAH_WALL: aqidah-indhold skal have sacred_representation = ''light''.';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_aqidah_wall
  before insert or update on content
  for each row
  execute function enforce_aqidah_wall();

comment on function enforce_aqidah_wall() is
  'Tredje lag i den hellige grænse (efter DB-RLS og pipeline-lag). '
  'Håndhæver uafhængigt af RLS-policy-tilstand: ai_service kan aldrig røre '
  'aqidah, kun approver/admin kan udgive aqidah, og kun med gyldig kildehenvisning.';
