-- B4.3.1C — POSTFLIGHT 202609290004
-- STRICTEMENT EN LECTURE SEULE.
-- Une seule requête / un seul résultat exportable.

with result as (
  select jsonb_build_object(
    'columns',
    (
      select jsonb_agg(jsonb_build_object(
        'column', column_name,
        'type', data_type,
        'nullable', is_nullable
      ) order by ordinal_position)
      from information_schema.columns
      where table_schema='public'
        and table_name='accounting_import_batches'
        and column_name in ('exercise_year','replaced_by_batch_id')
    ),
    'status_constraint',
    (
      select pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid='public.accounting_import_batches'::regclass
        and conname='accounting_import_batches_status_check'
    ),
    'validated_year_constraint',
    (
      select pg_get_constraintdef(oid)
      from pg_constraint
      where conrelid='public.accounting_import_batches'::regclass
        and conname='accounting_import_batches_validated_year_check'
    ),
    'active_snapshot_index',
    (
      select indexdef
      from pg_indexes
      where schemaname='public'
        and tablename='accounting_import_batches'
        and indexname='accounting_import_batches_active_snapshot_unique_idx'
    ),
    'rpc',
    (
      select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname='admin_replace_accounting_import_snapshot'
    ),
    'batches',
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id,
        'source', source,
        'exercise_year', exercise_year,
        'status', status,
        'replaced_by_batch_id', replaced_by_batch_id,
        'accepted_rows', accepted_rows,
        'gross_total', gross_total,
        'fees_total', fees_total,
        'net_total', net_total
      ) order by created_at), '[]'::jsonb)
      from public.accounting_import_batches
    ),
    'entries_by_batch_year',
    (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select source, import_batch_id,
               extract(year from entry_date)::integer as entry_year,
               count(*) as entry_count
        from public.accounting_entries
        where import_batch_id is not null
        group by source, import_batch_id, extract(year from entry_date)
        order by source, entry_year
      ) x
    )
  ) as data
)
select jsonb_pretty(jsonb_build_object(
  'postflight','202609290004_v410_accounting_import_snapshot',
  'read_only',true,
  'result',data
)) as postflight_result
from result;
