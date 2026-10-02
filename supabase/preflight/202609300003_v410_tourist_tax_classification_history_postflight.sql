WITH s AS (
 SELECT count(*) FILTER(WHERE column_name IN('id','classification','effective_from','effective_to','change_type','notes','created_at','updated_at')) cols
 FROM information_schema.columns WHERE table_schema='public' AND table_name='tourist_tax_classification_history'
), h AS (
 SELECT count(*) rows,count(*) FILTER(WHERE classification='unclassified' AND effective_from=DATE '2024-02-15'
 AND effective_to IS NULL AND change_type='initialization') init,count(*) FILTER(WHERE effective_to IS NULL) open
 FROM public.tourist_tax_classification_history
), p AS (
 SELECT count(*) rows,min(tourist_tax_classification) classification FROM public.pricing_settings
), r AS (
 SELECT count(*) n,bool_and(prosecdef) sec FROM pg_proc x JOIN pg_namespace ns ON ns.oid=x.pronamespace
 WHERE ns.nspname='public' AND proname='admin_set_tourist_tax_classification'
 AND pg_get_function_identity_arguments(x.oid)='p_classification text, p_effective_from date, p_notes text'
), c AS (
 SELECT count(*) FILTER(WHERE conname='tourist_tax_class_history_no_overlap') overlap
 FROM pg_constraint WHERE conrelid='public.tourist_tax_classification_history'::regclass
), q AS (
 SELECT relrowsecurity rls FROM pg_class WHERE oid='public.tourist_tax_classification_history'::regclass
), pol AS (
 SELECT count(*) n FROM pg_policies WHERE schemaname='public' AND tablename='tourist_tax_classification_history'
 AND policyname='tourist_tax_classification_history_owner_only'
)
SELECT 'A-5.1a POST-FLIGHT' check_name,
 CASE WHEN s.cols=8 AND h.rows=1 AND h.init=1 AND h.open=1 AND p.rows=1 AND p.classification='unclassified'
 AND r.n=1 AND r.sec IS TRUE AND c.overlap=1 AND q.rls IS TRUE AND pol.n=1 THEN 'OK' ELSE 'STOP' END status,
 s.cols expected_columns,h.rows history_rows,h.init expected_initial_rows,h.open open_periods,
 p.classification current_classification,r.n rpc_count,r.sec security_definer,c.overlap overlap_constraints,
 q.rls rls_enabled,pol.n policies
FROM s CROSS JOIN h CROSS JOIN p CROSS JOIN r CROSS JOIN c CROSS JOIN q CROSS JOIN pol;
