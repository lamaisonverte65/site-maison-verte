-- B4.3.1C — PRE-FLIGHT LIVE V2
-- Remplacement atomique des imports comptables par source/exercice
-- STRICTEMENT EN LECTURE SEULE.
-- Une seule requête / un seul résultat exportable depuis Supabase.
-- Aucune donnée ni aucun schéma n'est modifié.

with
columns_check as (
  select jsonb_build_object(
    'check', '01_columns',
    'data', coalesce(jsonb_agg(jsonb_build_object(
      'table', table_name,
      'column', column_name,
      'type', data_type,
      'nullable', is_nullable,
      'default', column_default
    ) order by table_name, ordinal_position), '[]'::jsonb)
  ) as item
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('accounting_import_batches', 'accounting_entries')
),
constraints_check as (
  select jsonb_build_object(
    'check', '02_constraints',
    'data', coalesce(jsonb_agg(jsonb_build_object(
      'table', c.conrelid::regclass::text,
      'name', c.conname,
      'definition', pg_get_constraintdef(c.oid)
    ) order by c.conrelid::regclass::text, c.conname), '[]'::jsonb)
  ) as item
  from pg_constraint c
  where c.conrelid in (
    'public.accounting_import_batches'::regclass,
    'public.accounting_entries'::regclass
  )
),
indexes_check as (
  select jsonb_build_object(
    'check', '03_indexes',
    'data', coalesce(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'name', indexname,
      'definition', indexdef
    ) order by tablename, indexname), '[]'::jsonb)
  ) as item
  from pg_indexes
  where schemaname = 'public'
    and tablename in ('accounting_import_batches', 'accounting_entries')
),
rls_check as (
  select jsonb_build_object(
    'check', '04_rls',
    'data', coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'policy', p.polname,
      'using', pg_get_expr(p.polqual, p.polrelid),
      'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
    ) order by c.relname, p.polname), '[]'::jsonb)
  ) as item
  from pg_class c
  left join pg_policy p on p.polrelid = c.oid
  where c.oid in (
    'public.accounting_import_batches'::regclass,
    'public.accounting_entries'::regclass
  )
),
owner_check as (
  select jsonb_build_object(
    'check', '05_owner_function',
    'data', coalesce(jsonb_agg(jsonb_build_object(
      'signature', p.oid::regprocedure::text,
      'definition', pg_get_functiondef(p.oid)
    )), '[]'::jsonb)
  ) as item
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'is_v4_owner'
),
batches_check as (
  select jsonb_build_object(
    'check', '06_batches',
    'data', coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'source', source,
      'filename', original_filename,
      'status', status,
      'imported_rows', imported_rows,
      'accepted_rows', accepted_rows,
      'rejected_rows', rejected_rows,
      'gross_total', gross_total,
      'fees_total', fees_total,
      'net_total', net_total,
      'created_at', created_at,
      'validated_at', validated_at,
      'metadata', metadata
    ) order by created_at desc), '[]'::jsonb)
  ) as item
  from public.accounting_import_batches
),
entries_check as (
  select jsonb_build_object(
    'check', '07_entries_by_batch',
    'data', coalesce(jsonb_agg(to_jsonb(x) order by x.entry_year desc, x.source, x.import_batch_id::text), '[]'::jsonb)
  ) as item
  from (
    select
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
  ) x
),
span_check as (
  select jsonb_build_object(
    'check', '08_batch_year_span',
    'data', coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  ) as item
  from (
    select
      b.id as batch_id,
      b.source,
      b.created_at,
      min(extract(year from e.entry_date)::integer) as min_entry_year,
      max(extract(year from e.entry_date)::integer) as max_entry_year,
      count(distinct extract(year from e.entry_date)::integer) as distinct_years
    from public.accounting_import_batches b
    left join public.accounting_entries e on e.import_batch_id = b.id
    group by b.id, b.source, b.created_at
  ) x
),
values_check as (
  select jsonb_build_object(
    'check', '09_values',
    'data', coalesce(jsonb_agg(to_jsonb(x) order by x.field, x.value), '[]'::jsonb)
  ) as item
  from (
    select 'batch_source'::text as field, source::text as value, count(*) as row_count
    from public.accounting_import_batches group by source
    union all
    select 'batch_status', status::text, count(*)
    from public.accounting_import_batches group by status
    union all
    select 'entry_source', source::text, count(*)
    from public.accounting_entries group by source
  ) x
)
select
  jsonb_pretty(jsonb_build_object(
    'preflight', 'B4.3.1C accounting import snapshot V2',
    'read_only', true,
    'checks', jsonb_build_array(
      (select item from columns_check),
      (select item from constraints_check),
      (select item from indexes_check),
      (select item from rls_check),
      (select item from owner_check),
      (select item from batches_check),
      (select item from entries_check),
      (select item from span_check),
      (select item from values_check)
    )
  )) as preflight_result;
