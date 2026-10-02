WITH pricing AS (
 SELECT count(*) row_count,min(tourist_tax_classification) classification FROM public.pricing_settings
), objects AS (
 SELECT to_regclass('public.tourist_tax_classification_history') IS NOT NULL history_exists,
 to_regprocedure('public.is_v4_owner()') IS NOT NULL owner_rpc_exists,
 to_regprocedure('public.admin_set_tourist_tax_classification(text,date,text)') IS NOT NULL set_rpc_exists
), rule_rpc AS (
 SELECT count(*) FILTER(WHERE p.proname='admin_add_tourist_tax_rule') n
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
)
SELECT 'A-5.1a PRE-FLIGHT' check_name,
 CASE WHEN pricing.row_count=1 AND pricing.classification='unclassified'
 AND NOT objects.history_exists AND objects.owner_rpc_exists AND NOT objects.set_rpc_exists
 AND rule_rpc.n=1 THEN 'OK' ELSE 'STOP' END status,
 pricing.row_count pricing_rows,pricing.classification current_classification,
 objects.history_exists,objects.owner_rpc_exists,objects.set_rpc_exists,
 rule_rpc.n admin_add_rule_count
FROM pricing CROSS JOIN objects CROSS JOIN rule_rpc;
