/* LMV V4.10 — B2 preflight LIVE — lecture seule, résultat unique */
with checks as (
  select '01_B1'::text section, 'customer_invoices'::text item,
    case when to_regclass('public.customer_invoices') is not null then 'OK' else 'ABSENT' end status,
    'table B1 requise'::text detail
  union all
  select '01_B1','payments',case when to_regclass('public.payments') is not null then 'OK' else 'ABSENT' end,'ledger requis'
  union all
  select '02_ABSENCE','customer_invoices_direct_booking_unique_idx',
    case when to_regclass('public.customer_invoices_direct_booking_unique_idx') is null then 'OK' else 'PRESENT' end,
    'doit être absent avant B2'
  union all
  select '03_DATA','customer_invoices',case when count(*)=0 then 'OK' else 'INFO' end,'rows='||count(*)::text from public.customer_invoices
  union all
  select '03_DATA','direct_duplicates',case when count(*)=0 then 'OK' else 'BLOCK' end,'groups='||count(*)::text
  from (select booking_request_id from public.customer_invoices where source='direct' and booking_request_id is not null group by booking_request_id having count(*)>1) d
)
select * from checks order by section,item;
