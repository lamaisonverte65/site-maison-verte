-- B4.3.1C — PRE-FLIGHT LIVE
-- Remplacement atomique des imports comptables par source/exercice
-- STRICTEMENT EN LECTURE SEULE : SELECT uniquement.
-- Exécuter ce fichier dans Supabase SQL Editor et me transmettre le résultat.
-- Ne modifie aucune donnée ni aucun schéma.

-- 1. Structure exacte des deux tables concernées
select
  '01_columns' as check_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('accounting_import_batches', 'accounting_entries')
order by table_name, ordinal_position;

-- 2. Contraintes des deux tables
select
  '02_constraints' as check_name,
  c.conrelid::regclass::text as table_name,
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid in (
  'public.accounting_import_batches'::regclass,
  'public.accounting_entries'::regclass
)
order by table_name, constraint_name;

-- 3. Index d'idempotence et index liés aux imports
select
  '03_indexes' as check_name,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('accounting_import_batches', 'accounting_entries')
order by tablename, indexname;

-- 4. RLS et politiques actuellement actives
select
  '04_rls' as check_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  p.polname as policy_name,
  pg_get_expr(p.polqual, p.polrelid) as using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.oid in (
  'public.accounting_import_batches'::regclass,
  'public.accounting_entries'::regclass
)
order by c.relname, p.polname;

-- 5. Fonction d'autorisation owner utilisée par les politiques
select
  '05_owner_function' as check_name,
  p.oid::regprocedure::text as function_signature,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_v4_owner';

-- 6. Lots réellement présents, sans données client
select
  '06_batches' as check_name,
  id,
  source,
  original_filename,
  status,
  imported_rows,
  accepted_rows,
  rejected_rows,
  gross_total,
  fees_total,
  net_total,
  created_at,
  validated_at,
  metadata
from public.accounting_import_batches
order by created_at desc;

-- 7. Comptage des écritures par lot/source/année uniquement
select
  '07_entries_by_batch' as check_name,
  e.source,
  extract(year from e.entry_date)::integer as entry_year,
  e.import_batch_id,
  count(*) as entry_count,
  count(*) filter (where e.entry_kind = 'income') as income_count,
  count(*) filter (where e.entry_kind = 'expense') as expense_count,
  coalesce(sum(e.amount_ttc) filter (where e.entry_kind = 'income'), 0) as income_total,
  coalesce(sum(e.amount_ttc) filter (where e.entry_kind = 'expense'), 0) as expense_total
from public.accounting_entries e
group by e.source, extract(year from e.entry_date), e.import_batch_id
order by entry_year desc, e.source, e.import_batch_id;

-- 8. Vérifie si un lot peut contenir plusieurs années d'encaissement.
-- C'est important avant de définir "un instantané par source/exercice".
select
  '08_batch_year_span' as check_name,
  b.id as batch_id,
  b.source,
  min(extract(year from e.entry_date)::integer) as min_entry_year,
  max(extract(year from e.entry_date)::integer) as max_entry_year,
  count(distinct extract(year from e.entry_date)::integer) as distinct_years
from public.accounting_import_batches b
left join public.accounting_entries e on e.import_batch_id = b.id
group by b.id, b.source
order by b.created_at desc;

-- 9. Vérifie les valeurs source/status réellement utilisées
select
  '09_values' as check_name,
  'batch_source' as field,
  source as value,
  count(*) as row_count
from public.accounting_import_batches
group by source
union all
select
  '09_values',
  'batch_status',
  status,
  count(*)
from public.accounting_import_batches
group by status
union all
select
  '09_values',
  'entry_source',
  source,
  count(*)
from public.accounting_entries
group by source
order by field, value;
