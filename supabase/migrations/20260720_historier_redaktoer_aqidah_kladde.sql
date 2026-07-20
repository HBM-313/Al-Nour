-- ============================================================================
-- Historiernes Bjerge: redaktør må oprette UVERIFICEREDE aqidah-kladder
-- (ejer-beslutning 2026-07-20). Løsner IKKE muren om hvem der kan verificere
-- eller udgive — det forbliver udelukkende approver/admin, håndhævet i BÅDE
-- RLS (ny politik nedenfor) OG triggeren enforce_aqidah_wall (nyt Lag D).
--
-- Før denne migration havde redaktør NUL skriveret til aqidah (bevist ved
-- regressionstest samme session: insert afvist, update ramte 0 rækker).
-- Efter denne migration:
--   - redaktør KAN indsætte en aqidah-kladde: content_type='aqidah',
--     is_published=false, is_source_verified=false (kildehenvisning +
--     is_locked_from_ai=true er allerede tvunget af aqidah_requires_source).
--   - redaktør KAN redigere kladden SÅ LÆNGE den er uverificeret+uudgivet.
--   - redaktør kan IKKE selv sætte is_source_verified=true eller
--     is_published=true — spærret i to uafhængige lag:
--       (a) RLS: UPDATE-politikkens USING-klausul genbruges som WITH CHECK
--           (Postgres' standardadfærd når WITH CHECK udelades), så en ny
--           rækkeversion med is_source_verified/is_published=true falder
--           uden for politikken og afvises.
--       (b) Triggerens nye Lag D: eksplicit fail-closed afvisning af at en
--           ikke-godkender sætter is_source_verified=true, uafhængigt af RLS.
--   - Så snart en godkender sætter is_source_verified=true, mister redaktør
--     UPDATE-adgang til rækken (USING kræver stadig is_source_verified=false)
--     — processen er nu godkenderens alene, ligesom udgivelse allerede var.
--
-- Verificeret med 9-punkts rollback-markør-regressionstest mod live-DB
-- (session 2026-07-20): editor-insert kladde ✓, editor kan ikke føde
-- verificeret/udgivet ✓, editor kan redigere egen kladde ✓, editor kan ikke
-- selv-verificere ✓, editor kan ikke selv-udgive ✓, godkender kan verificere
-- ✓, editor mister adgang efter verifikation ✓, godkender kan udgive den
-- verificerede kladde ✓, ai_service stadig fuldt spærret ✓. 0 rækker
-- efterladt i alle tests.
-- ============================================================================

-- --- RLS: ny INSERT-politik for redaktørens aqidah-kladder ---
create policy content_editor_write_aqidah_draft
on public.content
for insert
with check (
  auth_user_role() = 'editor'
  and content_type = 'aqidah'
  and is_published = false
  and is_source_verified = false
);

-- --- RLS: ny UPDATE-politik — kun mens kladden er uverificeret og uudgivet ---
-- Ingen eksplicit WITH CHECK: Postgres genbruger USING som WITH CHECK for
-- UPDATE-politikker uden egen WITH CHECK, hvilket automatisk spærrer
-- redaktøren fra at ændre is_source_verified/is_published til true (den nye
-- rækkeversion ville da falde uden for USING-betingelsen).
create policy content_editor_update_aqidah_draft
on public.content
for update
using (
  auth_user_role() = 'editor'
  and content_type = 'aqidah'
  and is_published = false
  and is_source_verified = false
);

-- --- Trigger: nyt Lag D — kilde-verifikation er også fail-closed ---
create or replace function enforce_aqidah_wall()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  jwt_role text;
  allowed boolean;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json->>'user_role', null);

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

  -- Lag D (NY): kilde-verifikation — fail closed, uafhængigt af RLS.
  -- Kun godkender/admin må sætte is_source_verified = true på aqidah, uanset
  -- om det sker alene eller sammen med udgivelse.
  if new.content_type = 'aqidah'
     and new.is_source_verified = true
     and (tg_op = 'INSERT' or old.is_source_verified is distinct from true)
  then
    if not allowed then
      raise exception 'AQIDAH_WALL: kun godkender eller admin kan markere aqidah kilde-verificeret (rolle: %, bruger: %).',
        coalesce(jwt_role, 'ingen'), current_user;
    end if;
  end if;

  return new;
end;
$function$;
