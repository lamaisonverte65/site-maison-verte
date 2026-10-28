-- Lecture seule, exécuter AVANT migration R18.
SELECT
  to_regclass('public.site_visits') IS NOT NULL AS table_site_visits,
  to_regprocedure('public.is_v4_owner()') IS NOT NULL AS fonction_owner,
  (SELECT count(*) = 0 FROM (
    SELECT required.column_name
    FROM (VALUES ('created_at'), ('event_type'), ('metadata'), ('page'),
                 ('source'), ('language'), ('device_type'), ('is_internal'))
      AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns AS c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'site_visits' AND c.column_name = required.column_name
    )
  ) missing) AS colonnes_requises_presentes,
  (SELECT relrowsecurity FROM pg_catalog.pg_class
     WHERE oid = to_regclass('public.site_visits')) AS rls_active,
  to_regprocedure('public.get_admin_visit_summary(integer)') IS NOT NULL AS fonction_r18_deja_installee;
