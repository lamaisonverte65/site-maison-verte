-- B4.3.1C — POSTFLIGHT 202609300001
-- STRICTEMENT EN LECTURE SEULE.
select jsonb_pretty(jsonb_build_object(
  'rpc_signature',
  (
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_commit_accounting_import_snapshot'
  ),
  'security_definer',
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_commit_accounting_import_snapshot'
  ),
  'booking_2025',
  (
    select jsonb_build_object(
      'batch_id',b.id,
      'source',b.source,
      'exercise_year',b.exercise_year,
      'status',b.status,
      'entries',count(e.id),
      'gross_total',b.gross_total,
      'fees_total',b.fees_total,
      'net_total',b.net_total
    )
    from public.accounting_import_batches b
    left join public.accounting_entries e on e.import_batch_id=b.id
    where b.source='booking' and b.exercise_year=2025 and b.status='validated'
    group by b.id
  )
)) as postflight_result;
