-- Voksnes sprogvalg-UI (opstart-prompt-6, spor 3): accounts.ui_language.
--
-- Drift-tjek (2026-07-24) viste at kun profiles har ui_language i dag —
-- accounts (forælder/admin-konti) har ingen tilsvarende kolonne. Denne
-- migration spejler profiles.ui_language 1:1 (samme type, default,
-- tilladte værdier) for skema-symmetri. 'en' er med i constraint'en ligesom
-- på profiles, selvom der (ligesom for profiles) endnu ikke findes nogen
-- en.ts-ordbog i koden — det er en kendt, allerede dokumenteret fremtidig
-- lakune, ikke noget denne migration skal løse.
--
-- INGEN RLS- eller trigger-ændring nødvendig: accounts_update_own dækker
-- allerede enhver kolonne på egen konto (kun trg_accounts_protect_role
-- vogter specifikt role/id, verificeret i funktionens krop før denne
-- migration blev skrevet). Samme mønster som consent_given_at/
-- consent_version i plan-samtykke-flow.md — ren dataudvidelse, ingen ny
-- politik.
--
-- Bevist med 3-punkts rollback-markør-regressionstest mod live-DB (0 rækker
-- persisteret): forælder kan sætte eget ui_language ✓ · forælder kan IKKE
-- ændre en anden forælders ui_language ✓ · ugyldig værdi ('fr') afvises af
-- check-constraint'en ✓.

alter table public.accounts
  add column if not exists ui_language text not null default 'da';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_ui_language_check'
  ) then
    alter table public.accounts
      add constraint accounts_ui_language_check
      check (ui_language = any (array['da'::text, 'ar'::text, 'en'::text]));
  end if;
end $$;
