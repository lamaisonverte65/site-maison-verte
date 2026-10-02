-- POST-FLIGHT LIVE — LECTURE SEULE
-- B4.2a-2 external_reservation_financials

-- Q1 — Colonnes réellement créées.
select
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'external_reservation_financials'
order by ordinal_position;

-- Q2 — Contraintes / FK / UNIQUE / CHECK.
select
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'external_reservation_financials'
order by c.contype, c.conname;

-- Q3 — Index.
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'external_reservation_financials'
order by indexname;

-- Q4 — RLS activée.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'external_reservation_financials';

-- Q5 — Policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'external_reservation_financials'
order by policyname;

-- Q6 — Privilèges explicites anon/authenticated.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'external_reservation_financials'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Attendu :
-- anon : aucune ligne
-- authenticated : SELECT / INSERT / UPDATE / DELETE,
--                 filtrés par la policy owner-only.

-- Q7 — Table vide immédiatement après migration.
select count(*) as row_count
from public.external_reservation_financials;

-- Attendu : 0.
