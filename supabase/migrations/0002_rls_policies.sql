-- ============================================================================
-- Nour — Fase 0: RLS-policies
-- ============================================================================
-- Lag 1 af den tekniske mur (databaselag). Lag 2 = pipeline (AI-service-rolle
-- kan kun skrive content_type='ai_allowed', håndhæves i applikationskode).
-- Lag 3 = UI (kilde-verificeret-mærke, håndhæves i frontend).
--
-- Nøgleprincip: ai_service-rollen (bruges af Claude API-integrationen) har
-- INGEN skriveret til aqidah-rækker, hverken insert eller update. Kun
-- 'approver' og 'admin' kan udgive/redigere aqidah.
-- ============================================================================

alter table accounts enable row level security;
alter table profiles enable row level security;
alter table characters enable row level security;
alter table content enable row level security;
alter table lessons enable row level security;
alter table progress enable row level security;
alter table classes enable row level security;
alter table class_members enable row level security;
alter table media enable row level security;
alter table content_reports enable row level security;

-- ----------------------------------------------------------------------------
-- Hjælpefunktioner: hvem er den kaldende bruger?
-- ----------------------------------------------------------------------------

create or replace function current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from accounts where auth_user_id = auth.uid();
$$;

create or replace function current_account_role()
returns account_role
language sql
stable
security definer
set search_path = public
as $$
  select role from accounts where auth_user_id = auth.uid();
$$;

create or replace function is_admin_or_approver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_account_role() in ('admin', 'approver'), false);
$$;

create or replace function is_admin_or_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_account_role() in ('admin', 'editor', 'approver'), false);
$$;

-- Note: den service-rolle Claude API-integrationen bruger til at INDSÆTTE
-- AI-genereret indhold, autentificerer IKKE via auth.uid() / accounts-tabellen
-- overhovedet. Den kører som en separat Postgres-rolle "ai_service" med sit
-- eget, meget snævre grant-sæt nedenfor — den har ingen af de ovenstående
-- rettigheder og ingen aqidah-adgang under nogen omstændighed.

-- ----------------------------------------------------------------------------
-- accounts
-- ----------------------------------------------------------------------------

create policy accounts_select_own on accounts
  for select using (auth_user_id = auth.uid() or is_admin_or_approver());

create policy accounts_update_own on accounts
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Kun admin kan oprette nye konti med forhøjede roller (editor/approver/admin).
-- Almindelige parent/teacher-konti oprettes via auth-signup-hook, ikke direkte insert.
create policy accounts_admin_manage on accounts
  for all using (current_account_role() = 'admin')
  with check (current_account_role() = 'admin');

-- ----------------------------------------------------------------------------
-- profiles — børn ser kun eget data
-- ----------------------------------------------------------------------------

create policy profiles_owner_all on profiles
  for all using (owner_account_id = current_account_id())
  with check (owner_account_id = current_account_id());

create policy profiles_teacher_read on profiles
  for select using (
    current_account_role() = 'teacher'
    and exists (
      select 1 from class_members cm
      join classes c on c.id = cm.class_id
      where cm.profile_id = profiles.id
      and c.teacher_account_id = current_account_id()
    )
  );

create policy profiles_admin_all on profiles
  for all using (current_account_role() = 'admin')
  with check (current_account_role() = 'admin');

-- ----------------------------------------------------------------------------
-- characters — offentligt læsbare, kun admin/editor kan redigere
-- ----------------------------------------------------------------------------

create policy characters_select_all on characters
  for select using (true);

create policy characters_editor_write on characters
  for insert with check (is_admin_or_editor());

create policy characters_editor_update on characters
  for update using (is_admin_or_editor())
  with check (is_admin_or_editor());

create policy characters_admin_delete on characters
  for delete using (current_account_role() = 'admin');

-- ----------------------------------------------------------------------------
-- content — DEN HELLIGE GRÆNSE
-- ----------------------------------------------------------------------------

-- Alle kan læse udgivet indhold.
create policy content_select_published on content
  for select using (is_published = true);

-- Redaktører/godkendere/admin kan se alt, også ikke-udgivet.
create policy content_select_internal on content
  for select using (is_admin_or_editor());

-- AI-TILLADT INDHOLD: editor/approver/admin kan indsætte og redigere,
-- MEN ALDRIG hvis content_type = 'aqidah'.
create policy content_editor_insert_ai_allowed on content
  for insert with check (
    is_admin_or_editor()
    and content_type = 'ai_allowed'
  );

create policy content_editor_update_ai_allowed on content
  for update using (
    is_admin_or_editor()
    and content_type = 'ai_allowed'
  )
  with check (
    content_type = 'ai_allowed'
  );

-- AQIDAH: kun approver/admin kan indsætte eller redigere aqidah-rækker.
-- Dette er selve muren på DB-niveau. Editor-rollen er eksplicit udelukket.
create policy content_approver_insert_aqidah on content
  for insert with check (
    is_admin_or_approver()
    and content_type = 'aqidah'
  );

create policy content_approver_update_aqidah on content
  for update using (
    is_admin_or_approver()
    and content_type = 'aqidah'
  )
  with check (
    content_type = 'aqidah'
  );

create policy content_admin_delete on content
  for delete using (current_account_role() = 'admin');

-- Bemærk: der findes IKKE en policy der lader ai_service-rollen skrive
-- content_type='aqidah' under nogen betingelse. ai_service har kun grants
-- (se nederst i filen) til insert på ai_allowed-rækker, og RLS filtrerer
-- desuden alt andet fra selvom applikationskoden skulle fejle.

-- ----------------------------------------------------------------------------
-- lessons
-- ----------------------------------------------------------------------------

create policy lessons_select_published on lessons
  for select using (is_published = true);

create policy lessons_select_internal on lessons
  for select using (is_admin_or_editor());

create policy lessons_editor_write on lessons
  for insert with check (is_admin_or_editor());

create policy lessons_editor_update on lessons
  for update using (is_admin_or_editor())
  with check (is_admin_or_editor());

create policy lessons_admin_delete on lessons
  for delete using (current_account_role() = 'admin');

-- ----------------------------------------------------------------------------
-- progress — kun ejer og lærer for egen klasse
-- ----------------------------------------------------------------------------

create policy progress_owner_all on progress
  for all using (
    exists (
      select 1 from profiles p
      where p.id = progress.profile_id
      and p.owner_account_id = current_account_id()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = progress.profile_id
      and p.owner_account_id = current_account_id()
    )
  );

create policy progress_teacher_read on progress
  for select using (
    current_account_role() = 'teacher'
    and exists (
      select 1 from class_members cm
      join classes c on c.id = cm.class_id
      where cm.profile_id = progress.profile_id
      and c.teacher_account_id = current_account_id()
    )
  );

create policy progress_admin_all on progress
  for all using (current_account_role() = 'admin')
  with check (current_account_role() = 'admin');

-- ----------------------------------------------------------------------------
-- classes / class_members
-- ----------------------------------------------------------------------------

create policy classes_teacher_owns on classes
  for all using (teacher_account_id = current_account_id())
  with check (teacher_account_id = current_account_id());

create policy classes_admin_all on classes
  for all using (current_account_role() = 'admin')
  with check (current_account_role() = 'admin');

create policy class_members_teacher on class_members
  for all using (
    exists (
      select 1 from classes c
      where c.id = class_members.class_id
      and c.teacher_account_id = current_account_id()
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = class_members.class_id
      and c.teacher_account_id = current_account_id()
    )
  );

create policy class_members_parent_join on class_members
  for insert with check (
    exists (
      select 1 from profiles p
      where p.id = class_members.profile_id
      and p.owner_account_id = current_account_id()
    )
  );

-- ----------------------------------------------------------------------------
-- media
-- ----------------------------------------------------------------------------

create policy media_select_all on media
  for select using (true);

create policy media_editor_write on media
  for insert with check (is_admin_or_editor());

create policy media_editor_update on media
  for update using (is_admin_or_editor())
  with check (is_admin_or_editor());

create policy media_admin_delete on media
  for delete using (current_account_role() = 'admin');

-- ----------------------------------------------------------------------------
-- content_reports
-- ----------------------------------------------------------------------------

create policy content_reports_insert_any_account on content_reports
  for insert with check (reporter_account_id = current_account_id());

create policy content_reports_select_own on content_reports
  for select using (reporter_account_id = current_account_id());

create policy content_reports_admin_editor_manage on content_reports
  for all using (is_admin_or_editor())
  with check (is_admin_or_editor());

-- ============================================================================
-- ai_service Postgres-rolle: separat, meget snæver rettighed
-- ============================================================================
-- Denne rolle bruges udelukkende af backend-integrationen mod Claude API.
-- Den autentificerer IKKE som en almindelig bruger (ingen auth.uid()), og
-- har derfor INGEN af policies ovenfor til rådighed via normal RLS-matching.
-- I stedet gives den et eksplicit, hardcoded snævert grant:
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_service') then
    create role ai_service nologin;
  end if;
end
$$;

grant usage on schema public to ai_service;
grant select on content, characters, lessons, media to ai_service;

-- ai_service må KUN indsætte rækker, og kun betingelser der matcher
-- ai_allowed. Denne policy er den eneste vej ind for ai_service, og den
-- nævner aldrig 'aqidah' som en gyldig værdi.
create policy content_ai_service_insert_ai_allowed_only on content
  for insert
  to ai_service
  with check (
    content_type = 'ai_allowed'
    and is_source_verified = false
    and is_locked_from_ai = false
  );

-- ai_service har eksplicit INGEN update- eller delete-policy overhovedet —
-- den kan kun indsætte nyt ai_allowed-udkast, aldrig ændre eksisterende
-- rækker (heller ikke sine egne). Redigering sker af editor/approver.
