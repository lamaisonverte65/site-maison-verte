/* LMV V4.10 B4.1 PRE-FLIGHT — lecture seule, un seul résultat */
with checks as (
 select '01_B1'::text section,'customer_invoices'::text item,case when to_regclass('public.customer_invoices') is not null then 'OK' else 'ABSENT' end status,'table requise'::text detail
 union all select '01_B1','issue_rpc',case when to_regprocedure('public.admin_issue_customer_invoice(uuid)') is not null then 'OK' else 'ABSENT' end,'RPC B1 requis'
 union all select '02_DATA','invoices','INFO','rows='||count(*)::text from public.customer_invoices
 union all select '02_DATA','drafts','INFO','rows='||count(*)::text from public.customer_invoices where status='draft'
 union all select '02_DATA','legacy_manual_drafts','INFO','rows='||count(*)::text from public.customer_invoices where status='draft' and financial_snapshot->>'draft_origin'='legacy_direct_manual'
 union all select '03_NUMBERING','counters','INFO','rows='||count(*)::text from public.customer_invoice_counters
)
select * from checks order by section,item;
