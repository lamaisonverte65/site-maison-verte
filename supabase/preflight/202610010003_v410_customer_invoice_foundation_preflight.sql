/* V4.10 B1 — PREFLIGHT FACTURATION CLIENT — LECTURE SEULE, UN SEUL RESULTAT */
with checks(section,item,status,detail) as (
  values
    ('01_PREREQ','booking_requests',case when to_regclass('public.booking_requests') is not null then 'OK' else 'ERROR' end,'table requise'),
    ('01_PREREQ','is_v4_owner()',case when to_regprocedure('public.is_v4_owner()') is not null then 'OK' else 'ERROR' end,'fonction requise'),
    ('02_ABSENCE','customer_invoices',case when to_regclass('public.customer_invoices') is null then 'OK' else 'ERROR' end,'doit être absente avant B1'),
    ('02_ABSENCE','customer_invoice_counters',case when to_regclass('public.customer_invoice_counters') is null then 'OK' else 'ERROR' end,'doit être absente avant B1'),
    ('02_ABSENCE','admin_issue_customer_invoice(uuid)',case when to_regprocedure('public.admin_issue_customer_invoice(uuid)') is null then 'OK' else 'ERROR' end,'doit être absente avant B1'),
    ('03_SEPARATION','accounting_documents',case when to_regclass('public.accounting_documents') is not null then 'OK' else 'INFO' end,'reste indépendante des factures clients'),
    ('04_DATA','booking_requests','INFO',(select 'rows='||count(*)::text from public.booking_requests))
)
select * from checks order by section,item;
