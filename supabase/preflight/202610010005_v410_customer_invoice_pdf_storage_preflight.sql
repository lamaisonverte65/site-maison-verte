/* LMV V4.10 B3 PRE-FLIGHT — lecture seule, un seul résultat */
with checks as (
  select '01_B1'::text section, 'customer_invoices'::text item,
    case when to_regclass('public.customer_invoices') is not null then 'OK' else 'ABSENT' end status,
    'table B1 requise'::text detail
  union all
  select '01_B1','pdf_storage_path',case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='customer_invoices' and column_name='pdf_storage_path') then 'OK' else 'ABSENT' end,'colonne B1 requise'
  union all
  select '02_BUCKET','customer-invoices',case when not exists(select 1 from storage.buckets where id='customer-invoices') then 'OK' else 'CHECK' end,'doit être absent avant B3'
  union all
  select '03_DATA','issued_without_pdf','INFO','rows=' || count(*)::text from public.customer_invoices where status='issued' and pdf_storage_path is null
  union all
  select '03_DATA','invoices','INFO','rows=' || count(*)::text from public.customer_invoices
)
select * from checks order by section,item;
