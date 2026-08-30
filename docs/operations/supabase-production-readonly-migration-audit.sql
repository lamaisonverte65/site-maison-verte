/*
  AUDIT SUPABASE PRODUCTION — STRICTEMENT EN LECTURE SEULE

  Migrations auditées ultérieurement :
    - 202608280001_owner_housekeeping_phase_a.sql
    - 202608280002_owner_housekeeping_phase_b.sql
    - 202608280003_housekeeping_notes.sql

  Sécurité :
    - chaque instruction exécutable de ce fichier est un SELECT ;
    - aucun SQL dynamique ;
    - aucune fonction applicative ou RPC ;
    - aucune table temporaire ;
    - aucune mutation Auth, donnée ou schéma ;
    - les identifiants métier et emails ne sont jamais retournés en clair.

  Exécution recommandée : lancer chaque bloc numéroté séparément dans
  Supabase SQL Editor et exporter/copier son résultat avec son numéro.
*/


/* 00 — Contexte de la session d'audit. */
SELECT
  '00_session_context' AS result_set,
  current_database() AS database_name,
  current_user AS current_role,
  session_user AS session_role,
  current_setting('server_version') AS postgres_version,
  current_setting('search_path') AS search_path;


/* 01 — Existence de toutes les relations prévues ou concernées. */
SELECT
  '01_relation_existence' AS result_set,
  expected.relation_name,
  to_regclass('public.' || expected.relation_name) IS NOT NULL AS exists_in_public,
  COALESCE(c.relkind::text, '-') AS relkind,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized view'
    WHEN 'f' THEN 'foreign table'
    ELSE 'absent/other'
  END AS relation_kind
FROM (
  SELECT unnest(ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[]) AS relation_name
) AS expected
LEFT JOIN pg_catalog.pg_namespace n
  ON n.nspname = 'public'
LEFT JOIN pg_catalog.pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = expected.relation_name
ORDER BY expected.relation_name;


/* 02 — Colonnes, types exacts, nullabilité, defaults et génération. */
SELECT
  '02_columns' AS result_set,
  cols.table_schema,
  cols.table_name,
  cols.ordinal_position,
  cols.column_name,
  cols.data_type,
  cols.udt_schema,
  cols.udt_name,
  cols.domain_schema,
  cols.domain_name,
  cols.character_maximum_length,
  cols.numeric_precision,
  cols.numeric_scale,
  cols.datetime_precision,
  cols.is_nullable,
  regexp_replace(
    regexp_replace(
      COALESCE(cols.column_default, ''),
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS column_default_masked,
  cols.is_identity,
  cols.identity_generation,
  cols.is_generated,
  regexp_replace(
    regexp_replace(
      COALESCE(cols.generation_expression, ''),
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS generation_expression_masked
FROM information_schema.columns cols
WHERE cols.table_schema = 'public'
  AND cols.table_name = ANY (ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[])
ORDER BY cols.table_name, cols.ordinal_position;


/* 03 — Nature des tables et état RLS/FORCE RLS. */
SELECT
  '03_rls_state' AS result_set,
  n.nspname AS table_schema,
  c.relname AS table_name,
  c.relkind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls_enabled,
  pg_catalog.pg_get_userbyid(c.relowner) AS table_owner
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND (
    c.relname::text = ANY (ARRAY[
      'admin_users',
      'booking_requests',
      'customers',
      'payments',
      'booking_events',
      'email_logs',
      'guest_reviews',
      'site_visits',
      'reservations',
      'stripe_payouts',
      'stripe_balance_transactions',
      'external_reservation_clients',
      'external_calendar_actions',
      'calendar_blocks',
      'pricing_settings',
      'season_prices',
      'price_overrides',
      'external_occupancies',
      'housekeeping_notes'
    ]::text[])
    OR c.relname ~* '(external|ical|calendar|communication|message|email|log)'
  )
ORDER BY c.relname;


/* 04 — PK et contraintes UNIQUE : colonnes et types dans l'ordre réel. */
SELECT
  '04_primary_and_unique_keys' AS result_set,
  child_ns.nspname AS table_schema,
  child.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' END AS constraint_type,
  key_col.ordinality AS column_position,
  att.attname AS column_name,
  pg_catalog.format_type(att.atttypid, att.atttypmod) AS postgres_type,
  con.condeferrable AS is_deferrable,
  con.condeferred AS initially_deferred,
  con.convalidated AS is_validated
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class child ON child.oid = con.conrelid
JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key_col(attnum, ordinality) ON TRUE
JOIN pg_catalog.pg_attribute att
  ON att.attrelid = child.oid
 AND att.attnum = key_col.attnum
WHERE child_ns.nspname = 'public'
  AND con.contype IN ('p', 'u')
  AND child.relname::text = ANY (ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[])
ORDER BY child.relname, constraint_type, con.conname, key_col.ordinality;


/* 05 — FK avec type exact de chaque colonne enfant et parent. */
SELECT
  '05_foreign_keys_typed' AS result_set,
  child_ns.nspname AS child_schema,
  child.relname AS child_table,
  con.conname AS constraint_name,
  child_col.ordinality AS column_position,
  child_att.attname AS child_column,
  pg_catalog.format_type(child_att.atttypid, child_att.atttypmod) AS child_postgres_type,
  parent_ns.nspname AS parent_schema,
  parent.relname AS parent_table,
  parent_att.attname AS parent_column,
  pg_catalog.format_type(parent_att.atttypid, parent_att.atttypmod) AS parent_postgres_type,
  child_att.atttypid = parent_att.atttypid AS same_base_type_oid,
  con.confupdtype AS update_action_code,
  con.confdeltype AS delete_action_code,
  con.convalidated AS is_validated
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class child ON child.oid = con.conrelid
JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid = child.relnamespace
JOIN pg_catalog.pg_class parent ON parent.oid = con.confrelid
JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS child_col(attnum, ordinality) ON TRUE
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS parent_col(attnum, ordinality)
  ON parent_col.ordinality = child_col.ordinality
JOIN pg_catalog.pg_attribute child_att
  ON child_att.attrelid = child.oid
 AND child_att.attnum = child_col.attnum
JOIN pg_catalog.pg_attribute parent_att
  ON parent_att.attrelid = parent.oid
 AND parent_att.attnum = parent_col.attnum
WHERE con.contype = 'f'
  AND (
    (child_ns.nspname = 'public' AND child.relname::text = ANY (ARRAY[
      'admin_users',
      'booking_requests',
      'customers',
      'payments',
      'booking_events',
      'email_logs',
      'guest_reviews',
      'site_visits',
      'reservations',
      'stripe_payouts',
      'stripe_balance_transactions',
      'external_reservation_clients',
      'external_calendar_actions',
      'calendar_blocks',
      'pricing_settings',
      'season_prices',
      'price_overrides',
      'external_occupancies',
      'housekeeping_notes'
    ]::text[]))
    OR
    (parent_ns.nspname = 'public' AND parent.relname::text = ANY (ARRAY[
      'admin_users',
      'booking_requests',
      'customers',
      'external_reservation_clients',
      'external_calendar_actions',
      'external_occupancies',
      'housekeeping_notes'
    ]::text[]))
  )
ORDER BY child_ns.nspname, child.relname, con.conname, child_col.ordinality;


/* 06 — Toutes les contraintes des tables concernées. */
SELECT
  '06_constraints' AS result_set,
  n.nspname AS table_schema,
  c.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'x' THEN 'EXCLUSION'
    WHEN 'n' THEN 'NOT NULL'
    ELSE con.contype::text
  END AS constraint_type,
  regexp_replace(
    regexp_replace(
      pg_catalog.pg_get_constraintdef(con.oid, TRUE),
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS definition_masked,
  con.convalidated AS is_validated,
  con.condeferrable AS is_deferrable,
  con.condeferred AS initially_deferred
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname::text = ANY (ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[])
ORDER BY c.relname, constraint_type, con.conname;


/* 07 — Index existants et définitions. */
SELECT
  '07_indexes' AS result_set,
  idx.schemaname AS table_schema,
  idx.tablename AS table_name,
  idx.indexname AS index_name,
  regexp_replace(
    regexp_replace(
      idx.indexdef,
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS index_definition_masked
FROM pg_catalog.pg_indexes idx
WHERE idx.schemaname = 'public'
  AND idx.tablename = ANY (ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[])
ORDER BY idx.tablename, idx.indexname;


/* 08 — Policies RLS : mode, rôles, commande, USING et WITH CHECK. */
SELECT
  '08_policies' AS result_set,
  pol.schemaname AS table_schema,
  pol.tablename AS table_name,
  pol.policyname AS policy_name,
  pol.permissive,
  pol.roles,
  pol.cmd AS command,
  regexp_replace(
    regexp_replace(
      COALESCE(pol.qual, ''),
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS using_expression_masked,
  regexp_replace(
    regexp_replace(
      COALESCE(pol.with_check, ''),
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS with_check_expression_masked
FROM pg_catalog.pg_policies pol
WHERE pol.schemaname = 'public'
  AND (
    pol.tablename = ANY (ARRAY[
      'admin_users',
      'booking_requests',
      'customers',
      'payments',
      'booking_events',
      'email_logs',
      'guest_reviews',
      'site_visits',
      'reservations',
      'stripe_payouts',
      'stripe_balance_transactions',
      'external_reservation_clients',
      'external_calendar_actions',
      'calendar_blocks',
      'pricing_settings',
      'season_prices',
      'price_overrides',
      'external_occupancies',
      'housekeeping_notes'
    ]::text[])
    OR pol.tablename ~* '(external|ical|calendar|communication|message|email|log)'
  )
ORDER BY pol.tablename, pol.policyname;


/* 09 — Grants de tables, y compris autres rôles applicatifs éventuels. */
SELECT
  '09_table_grants' AS result_set,
  grants.table_schema,
  grants.table_name,
  grants.grantee,
  grants.privilege_type,
  grants.is_grantable,
  grants.with_hierarchy
FROM information_schema.role_table_grants grants
WHERE grants.table_schema = 'public'
  AND grants.table_name = ANY (ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[])
ORDER BY grants.table_name, grants.grantee, grants.privilege_type;


/* 10 — Propriétés des rôles importants pour RLS et service_role. */
SELECT
  '10_role_properties' AS result_set,
  roles.rolname AS role_name,
  roles.rolcanlogin AS can_login,
  roles.rolsuper AS is_superuser,
  roles.rolinherit AS inherits_privileges,
  roles.rolbypassrls AS bypasses_rls,
  roles.rolcreaterole AS can_create_roles,
  roles.rolcreatedb AS can_create_databases
FROM pg_catalog.pg_roles roles
WHERE roles.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator')
   OR (
     roles.rolname !~ '^pg_'
     AND roles.rolname NOT IN (
       'postgres',
       'supabase_admin',
       'supabase_auth_admin',
       'supabase_storage_admin',
       'dashboard_user'
     )
     AND roles.rolname ~* '(admin|app|owner|housekeeping)'
   )
ORDER BY roles.rolname;


/* 11 — Appartenance des rôles applicatifs importants. */
SELECT
  '11_role_memberships' AS result_set,
  member_role.rolname AS member_role,
  granted_role.rolname AS granted_role,
  memberships.admin_option,
  grantor_role.rolname AS grantor_role
FROM pg_catalog.pg_auth_members memberships
JOIN pg_catalog.pg_roles member_role ON member_role.oid = memberships.member
JOIN pg_catalog.pg_roles granted_role ON granted_role.oid = memberships.roleid
LEFT JOIN pg_catalog.pg_roles grantor_role ON grantor_role.oid = memberships.grantor
WHERE member_role.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator')
   OR granted_role.rolname IN ('anon', 'authenticated', 'service_role', 'authenticator')
ORDER BY member_role.rolname, granted_role.rolname;


/* 12 — Fonction is_v4_owner existante, sans l'appeler. */
SELECT
  '12_is_v4_owner_function' AS result_set,
  n.nspname AS function_schema,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(p.oid) AS result_type,
  l.lanname AS language_name,
  p.prosecdef AS security_definer,
  p.provolatile AS volatility_code,
  pg_catalog.pg_get_userbyid(p.proowner) AS function_owner,
  regexp_replace(
    regexp_replace(
      p.prosrc,
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS function_body_masked
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'is_v4_owner'
ORDER BY pg_catalog.pg_get_function_identity_arguments(p.oid);


/* 13 — Grants de la fonction is_v4_owner, si elle existe déjà. */
SELECT
  '13_is_v4_owner_grants' AS result_set,
  grants.routine_schema,
  grants.routine_name,
  grants.grantee,
  grants.privilege_type,
  grants.is_grantable
FROM information_schema.role_routine_grants grants
WHERE grants.routine_schema = 'public'
  AND grants.routine_name = 'is_v4_owner'
ORDER BY grants.grantee, grants.privilege_type;


/* 14 — Dépendances techniques de la migration des notes. */
SELECT
  '14_housekeeping_dependencies' AS result_set,
  'gen_random_uuid_function' AS dependency,
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'gen_random_uuid'
      AND n.nspname IN ('pg_catalog', 'public', 'extensions')
  ) AS available,
  'Fonction nécessaire aux UUID par défaut' AS purpose
UNION ALL
SELECT
  '14_housekeeping_dependencies',
  'anon_role',
  EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon'),
  'Rôle visé par les révocations'
UNION ALL
SELECT
  '14_housekeeping_dependencies',
  'authenticated_role',
  EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated'),
  'Rôle visé par les révocations'
UNION ALL
SELECT
  '14_housekeeping_dependencies',
  'service_role',
  EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role'),
  'Rôle utilisé par les fonctions Netlify';


/* 15 — Synthèse strictement agrégée de admin_users. */
SELECT
  '15_admin_users_summary' AS result_set,
  count(*) AS total_profiles,
  count(*) FILTER (WHERE is_active IS TRUE) AS active_profiles,
  count(*) FILTER (WHERE is_active IS NOT TRUE) AS inactive_or_null_profiles,
  count(*) FILTER (WHERE is_owner IS TRUE) AS owner_flag_profiles,
  count(*) FILTER (
    WHERE role = 'owner'
      AND is_owner IS TRUE
      AND is_active IS TRUE
  ) AS strict_active_owners,
  count(*) FILTER (WHERE auth_user_id IS NULL) AS null_auth_user_id,
  count(*) FILTER (WHERE auth_user_id IS NOT NULL) AS non_null_auth_user_id,
  count(*) FILTER (WHERE role = 'read_only') AS historical_read_only_profiles,
  count(*) FILTER (
    WHERE is_active IS TRUE
      AND role IS NOT NULL
      AND role NOT IN ('owner', 'housekeeping')
  ) AS active_legacy_role_profiles,
  count(*) FILTER (
    WHERE is_active IS TRUE
      AND role IS NULL
  ) AS active_profiles_with_null_role,
  count(*) FILTER (
    WHERE is_active IS TRUE
      AND auth_user_id IS NULL
  ) AS active_without_auth_user_id
FROM public.admin_users;


/* 16 — Rôles présents et comptages, sans identité individuelle. */
SELECT
  '16_admin_users_roles' AS result_set,
  COALESCE(role, '[NULL]') AS role,
  count(*) AS profile_count,
  count(*) FILTER (WHERE is_active IS TRUE) AS active_count,
  count(*) FILTER (WHERE is_active IS NOT TRUE) AS inactive_or_null_count,
  count(*) FILTER (WHERE is_owner IS TRUE) AS owner_flag_count,
  count(*) FILTER (WHERE auth_user_id IS NULL) AS null_auth_user_id_count,
  count(*) FILTER (WHERE auth_user_id IS NOT NULL) AS linked_auth_user_id_count
FROM public.admin_users
GROUP BY role
ORDER BY role NULLS FIRST;


/* 17 — Forme réelle des valeurs historiques de permissions. */
SELECT
  '17_admin_permissions_shape' AS result_set,
  CASE
    WHEN permissions IS NULL THEN 'sql_null'
    ELSE COALESCE(jsonb_typeof(to_jsonb(permissions)), 'unknown')
  END AS permissions_shape,
  count(*) AS profile_count,
  count(*) FILTER (WHERE is_active IS TRUE) AS active_profile_count,
  count(*) FILTER (WHERE role = 'owner') AS owner_role_count,
  count(*) FILTER (WHERE role = 'read_only') AS read_only_role_count
FROM public.admin_users
GROUP BY permissions_shape
ORDER BY permissions_shape;


/* 18 — Violations historiques potentielles, uniquement en comptages. */
SELECT
  '18_admin_users_historical_checks' AS result_set,
  'active_role_outside_owner_housekeeping' AS check_name,
  count(*) AS violating_rows
FROM public.admin_users
WHERE is_active IS TRUE
  AND role IS NOT NULL
  AND role NOT IN ('owner', 'housekeeping')
UNION ALL
SELECT
  '18_admin_users_historical_checks',
  'active_profile_with_null_role',
  count(*)
FROM public.admin_users
WHERE is_active IS TRUE
  AND role IS NULL
UNION ALL
SELECT
  '18_admin_users_historical_checks',
  'more_than_one_owner_flag',
  CASE WHEN count(*) > 1 THEN count(*) ELSE 0 END
FROM public.admin_users
WHERE is_owner IS TRUE
UNION ALL
SELECT
  '18_admin_users_historical_checks',
  'owner_role_inactive',
  count(*)
FROM public.admin_users
WHERE role = 'owner'
  AND is_active IS NOT TRUE
UNION ALL
SELECT
  '18_admin_users_historical_checks',
  'role_owner_flag_incoherent',
  count(*)
FROM public.admin_users
WHERE (role = 'owner') IS DISTINCT FROM (is_owner IS TRUE)
UNION ALL
SELECT
  '18_admin_users_historical_checks',
  'active_profile_without_auth_user_id',
  count(*)
FROM public.admin_users
WHERE is_active IS TRUE
  AND auth_user_id IS NULL
ORDER BY check_name;


/* 19 — Doublons auth_user_id et email normalisé, en agrégats seulement. */
SELECT
  '19_admin_users_duplicate_checks' AS result_set,
  'duplicate_auth_user_id_groups' AS check_name,
  count(*) AS duplicate_groups,
  COALESCE(sum(group_size), 0)::bigint AS affected_rows
FROM (
  SELECT auth_user_id, count(*) AS group_size
  FROM public.admin_users
  WHERE auth_user_id IS NOT NULL
  GROUP BY auth_user_id
  HAVING count(*) > 1
) duplicate_auth
UNION ALL
SELECT
  '19_admin_users_duplicate_checks',
  'duplicate_normalized_email_groups',
  count(*),
  COALESCE(sum(group_size), 0)::bigint
FROM (
  SELECT lower(btrim(email)) AS normalized_email, count(*) AS group_size
  FROM public.admin_users
  WHERE email IS NOT NULL
    AND btrim(email) <> ''
  GROUP BY lower(btrim(email))
  HAVING count(*) > 1
) duplicate_email
ORDER BY check_name;


/* 20 — Cohérence globale avec auth.users, sans email ni UUID retourné. */
SELECT
  '20_admin_auth_coherence_summary' AS result_set,
  count(*) AS total_admin_profiles,
  count(*) FILTER (WHERE au.auth_user_id IS NULL) AS profiles_without_auth_reference,
  count(*) FILTER (
    WHERE au.auth_user_id IS NOT NULL
      AND auth_user.id IS NOT NULL
  ) AS profiles_matched_by_auth_user_id,
  count(*) FILTER (
    WHERE au.auth_user_id IS NOT NULL
      AND auth_user.id IS NULL
  ) AS profiles_with_orphan_auth_user_id,
  count(*) FILTER (
    WHERE auth_user.id IS NOT NULL
      AND lower(btrim(COALESCE(au.email, ''))) = lower(btrim(COALESCE(auth_user.email, '')))
  ) AS matched_id_and_email,
  count(*) FILTER (
    WHERE auth_user.id IS NOT NULL
      AND lower(btrim(COALESCE(au.email, ''))) <> lower(btrim(COALESCE(auth_user.email, '')))
  ) AS matched_id_but_email_differs,
  count(*) FILTER (
    WHERE au.auth_user_id IS NULL
      AND (
        SELECT count(*)
        FROM auth.users candidate
        WHERE lower(btrim(COALESCE(candidate.email, ''))) = lower(btrim(COALESCE(au.email, '')))
          AND btrim(COALESCE(au.email, '')) <> ''
      ) = 1
  ) AS unlinked_profiles_with_one_email_candidate,
  count(*) FILTER (
    WHERE au.auth_user_id IS NULL
      AND (
        SELECT count(*)
        FROM auth.users candidate
        WHERE lower(btrim(COALESCE(candidate.email, ''))) = lower(btrim(COALESCE(au.email, '')))
          AND btrim(COALESCE(au.email, '')) <> ''
      ) > 1
  ) AS unlinked_profiles_with_ambiguous_email_candidates
FROM public.admin_users au
LEFT JOIN auth.users auth_user ON auth_user.id = au.auth_user_id;


/* 21 — Cas Auth incohérents sous étiquettes locales masquées. */
SELECT
  '21_admin_auth_masked_anomalies' AS result_set,
  'profile-' || lpad(
    row_number() OVER (ORDER BY au.id::text)::text,
    3,
    '0'
  ) AS masked_profile,
  COALESCE(au.role, '[NULL]') AS role,
  au.is_owner,
  au.is_active,
  au.auth_user_id IS NOT NULL AS has_auth_user_id,
  CASE WHEN auth_user.id IS NULL THEN 0 ELSE 1 END AS auth_id_match_count,
  (
    SELECT count(*)
    FROM auth.users candidate
    WHERE lower(btrim(COALESCE(candidate.email, ''))) = lower(btrim(COALESCE(au.email, '')))
      AND btrim(COALESCE(au.email, '')) <> ''
  ) AS normalized_email_auth_match_count,
  CASE
    WHEN au.auth_user_id IS NULL THEN 'auth_user_id_missing'
    WHEN auth_user.id IS NULL THEN 'auth_user_id_orphan'
    WHEN lower(btrim(COALESCE(au.email, ''))) <> lower(btrim(COALESCE(auth_user.email, '')))
      THEN 'auth_id_matches_but_email_differs'
    WHEN (
      SELECT count(*)
      FROM public.admin_users duplicate_profile
      WHERE duplicate_profile.auth_user_id = au.auth_user_id
    ) > 1 THEN 'auth_user_id_shared_by_profiles'
    ELSE 'other'
  END AS anomaly_type
FROM public.admin_users au
LEFT JOIN auth.users auth_user ON auth_user.id = au.auth_user_id
WHERE au.auth_user_id IS NULL
   OR auth_user.id IS NULL
   OR lower(btrim(COALESCE(au.email, ''))) <> lower(btrim(COALESCE(auth_user.email, '')))
   OR (
     SELECT count(*)
     FROM public.admin_users duplicate_profile
     WHERE duplicate_profile.auth_user_id = au.auth_user_id
   ) > 1
ORDER BY masked_profile;


/* 22 — Doublons éventuels d'emails normalisés dans auth.users, agrégés. */
SELECT
  '22_auth_users_duplicate_email_summary' AS result_set,
  count(*) AS duplicate_normalized_email_groups,
  COALESCE(sum(group_size), 0)::bigint AS affected_auth_users
FROM (
  SELECT lower(btrim(email)) AS normalized_email, count(*) AS group_size
  FROM auth.users
  WHERE email IS NOT NULL
    AND btrim(email) <> ''
  GROUP BY lower(btrim(email))
  HAVING count(*) > 1
) duplicate_auth_emails;


/* 23 — Matrice de compatibilité des index/contraintes Phase A et Phase B. */
SELECT
  '23_phase_a_b_data_compatibility' AS result_set,
  'admin_users_email_normalized_key' AS proposed_object,
  (
    SELECT count(*)
    FROM (
      SELECT lower(btrim(email))
      FROM public.admin_users
      WHERE email IS NOT NULL
        AND btrim(email) <> ''
      GROUP BY lower(btrim(email))
      HAVING count(*) > 1
    ) violations
  ) AS violation_count,
  CASE WHEN (
    SELECT count(*)
    FROM (
      SELECT lower(btrim(email))
      FROM public.admin_users
      WHERE email IS NOT NULL
        AND btrim(email) <> ''
      GROUP BY lower(btrim(email))
      HAVING count(*) > 1
    ) violations
  ) = 0 THEN 'compatible_by_data' ELSE 'requires_data_repair' END AS data_assessment
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_auth_user_id_key',
  (
    SELECT count(*)
    FROM (
      SELECT auth_user_id
      FROM public.admin_users
      WHERE auth_user_id IS NOT NULL
      GROUP BY auth_user_id
      HAVING count(*) > 1
    ) violations
  ),
  CASE WHEN (
    SELECT count(*)
    FROM (
      SELECT auth_user_id
      FROM public.admin_users
      WHERE auth_user_id IS NOT NULL
      GROUP BY auth_user_id
      HAVING count(*) > 1
    ) violations
  ) = 0 THEN 'compatible_by_data' ELSE 'requires_data_repair' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_single_owner_key',
  CASE WHEN (SELECT count(*) FROM public.admin_users WHERE is_owner IS TRUE) > 1 THEN 1 ELSE 0 END,
  CASE WHEN (SELECT count(*) FROM public.admin_users WHERE is_owner IS TRUE) <= 1
    THEN 'compatible_by_data' ELSE 'requires_data_repair' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_owner_coherent',
  (
    SELECT count(*)
    FROM public.admin_users
    WHERE (role = 'owner') IS DISTINCT FROM (is_owner IS TRUE)
  ),
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users
    WHERE (role = 'owner') IS DISTINCT FROM (is_owner IS TRUE)
  ) = 0
    THEN 'compatible_by_data' ELSE 'requires_data_repair' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_owner_active',
  (
    SELECT count(*)
    FROM public.admin_users
    WHERE (role <> 'owner' OR is_active IS TRUE) IS FALSE
  ),
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users
    WHERE (role <> 'owner' OR is_active IS TRUE) IS FALSE
  ) = 0
    THEN 'compatible_by_data' ELSE 'requires_data_repair' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_active_role_allowed',
  (
    SELECT count(*)
    FROM public.admin_users
    WHERE is_active IS TRUE
      AND role IS NOT NULL
      AND role NOT IN ('owner', 'housekeeping')
  ),
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users
    WHERE is_active IS TRUE
      AND role IS NOT NULL
      AND role NOT IN ('owner', 'housekeeping')
  ) = 0 THEN 'compatible_by_data' ELSE 'requires_data_repair_before_phase_b' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'active_profile_with_null_role',
  (
    SELECT count(*)
    FROM public.admin_users
    WHERE is_active IS TRUE
      AND role IS NULL
  ),
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users
    WHERE is_active IS TRUE
      AND role IS NULL
  ) = 0 THEN 'compatible_by_data' ELSE 'requires_data_repair_before_phase_b' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_auth_user_fk',
  (
    SELECT count(*)
    FROM public.admin_users au
    LEFT JOIN auth.users auth_user ON auth_user.id = au.auth_user_id
    WHERE au.auth_user_id IS NOT NULL
      AND auth_user.id IS NULL
  ),
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users au
    LEFT JOIN auth.users auth_user ON auth_user.id = au.auth_user_id
    WHERE au.auth_user_id IS NOT NULL
      AND auth_user.id IS NULL
  ) = 0 THEN 'compatible_by_data' ELSE 'requires_data_repair' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'phase_b_exactly_one_linked_strict_owner',
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users
    WHERE role = 'owner'
      AND is_owner IS TRUE
      AND is_active IS TRUE
      AND auth_user_id IS NOT NULL
  ) = 1 THEN 0 ELSE 1 END,
  CASE WHEN (
    SELECT count(*)
    FROM public.admin_users
    WHERE role = 'owner'
      AND is_owner IS TRUE
      AND is_active IS TRUE
      AND auth_user_id IS NOT NULL
  ) = 1 THEN 'phase_b_precondition_met' ELSE 'phase_b_blocked' END
UNION ALL
SELECT
  '23_phase_a_b_data_compatibility',
  'admin_users_active_auth_required',
  (SELECT count(*) FROM public.admin_users WHERE is_active IS TRUE AND auth_user_id IS NULL),
  CASE WHEN (SELECT count(*) FROM public.admin_users WHERE is_active IS TRUE AND auth_user_id IS NULL) = 0
    THEN 'phase_b_precondition_met' ELSE 'requires_auth_repair_or_deactivation' END
ORDER BY proposed_object;


/* 24 — Découverte des structures réellement liées à iCal/externe/calendrier. */
SELECT
  '24_external_schema_discovery' AS result_set,
  cols.table_schema,
  cols.table_name,
  string_agg(cols.column_name, ', ' ORDER BY cols.ordinal_position) AS all_columns,
  string_agg(
    cols.column_name,
    ', ' ORDER BY cols.ordinal_position
  ) FILTER (
    WHERE cols.column_name ~* '(^source$|uid|external|ical|start|end|status|title|summary|guest|customer|client|adult|child|phone|email|message|price|amount)'
  ) AS relevant_columns
FROM information_schema.columns cols
WHERE cols.table_schema = 'public'
GROUP BY cols.table_schema, cols.table_name
HAVING cols.table_name ~* '(external|ical|calendar)'
    OR bool_or(
      cols.column_name ~* '(^external_uid$|^uid$|ical|external_source)'
    )
ORDER BY cols.table_name;


/* 25 — Détail typé des colonnes utiles aux occupations et enrichissements. */
SELECT
  '25_external_relevant_columns' AS result_set,
  cols.table_name,
  cols.ordinal_position,
  cols.column_name,
  cols.data_type,
  cols.udt_name,
  cols.character_maximum_length,
  cols.is_nullable,
  regexp_replace(
    regexp_replace(
      COALESCE(cols.column_default, ''),
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS column_default_masked
FROM information_schema.columns cols
WHERE cols.table_schema = 'public'
  AND (
    cols.table_name ~* '(external|ical|calendar)'
    OR cols.table_name IN ('booking_requests', 'customers')
  )
  AND cols.column_name ~* '(^id$|^source$|uid|external|ical|start|end|status|title|summary|guest|customer|client|adult|child|phone|email|message|price|amount|arrival|departure|practical|housekeeping)'
ORDER BY cols.table_name, cols.ordinal_position;


/*
  26 — Valeurs source réelles.
  Ces trois tables sont des structures actuelles demandées par l'audit.
  Si le bloc 01 indique qu'une d'elles est absente, ne lancez pas ce bloc et
  transmettez simplement l'absence observée dans le bloc 01.
*/
SELECT
  '26_source_values' AS result_set,
  'booking_requests' AS table_name,
  COALESCE(source::text, '[NULL]') AS source_value,
  count(*) AS row_count
FROM public.booking_requests
GROUP BY source
UNION ALL
SELECT
  '26_source_values',
  'external_reservation_clients',
  COALESCE(source::text, '[NULL]'),
  count(*)
FROM public.external_reservation_clients
GROUP BY source
UNION ALL
SELECT
  '26_source_values',
  'external_calendar_actions',
  COALESCE(source::text, '[NULL]'),
  count(*)
FROM public.external_calendar_actions
GROUP BY source
ORDER BY table_name, source_value;


/*
  27 — Qualité des couples source/UID actuels, sans retourner aucun UID.
  Même précondition d'existence que le bloc 26.
*/
SELECT
  '27_external_target_quality' AS result_set,
  'external_reservation_clients' AS table_name,
  count(*) AS total_rows,
  count(*) FILTER (WHERE source IS NULL OR btrim(source::text) = '') AS missing_source_rows,
  count(*) FILTER (WHERE uid IS NULL OR btrim(uid::text) = '') AS missing_uid_rows,
  count(DISTINCT (source::text, uid::text)) FILTER (
    WHERE source IS NOT NULL
      AND btrim(source::text) <> ''
      AND uid IS NOT NULL
      AND btrim(uid::text) <> ''
  ) AS distinct_complete_targets,
  count(*) - count(DISTINCT (source::text, uid::text)) FILTER (
    WHERE source IS NOT NULL
      AND btrim(source::text) <> ''
      AND uid IS NOT NULL
      AND btrim(uid::text) <> ''
  ) AS rows_beyond_distinct_complete_targets,
  count(*) FILTER (WHERE start_date IS NULL) AS missing_start_date_rows,
  count(*) FILTER (WHERE end_date IS NULL) AS missing_end_date_rows,
  count(*) FILTER (
    WHERE start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND end_date <= start_date
  ) AS invalid_or_empty_period_rows
FROM public.external_reservation_clients
UNION ALL
SELECT
  '27_external_target_quality',
  'external_calendar_actions',
  count(*),
  count(*) FILTER (WHERE source IS NULL OR btrim(source::text) = ''),
  count(*) FILTER (WHERE uid IS NULL OR btrim(uid::text) = ''),
  count(DISTINCT (source::text, uid::text)) FILTER (
    WHERE source IS NOT NULL
      AND btrim(source::text) <> ''
      AND uid IS NOT NULL
      AND btrim(uid::text) <> ''
  ),
  count(*) - count(DISTINCT (source::text, uid::text)) FILTER (
    WHERE source IS NOT NULL
      AND btrim(source::text) <> ''
      AND uid IS NOT NULL
      AND btrim(uid::text) <> ''
  ),
  count(*) FILTER (WHERE start_date IS NULL),
  count(*) FILTER (WHERE end_date IS NULL),
  count(*) FILTER (
    WHERE start_date IS NOT NULL
      AND end_date IS NOT NULL
      AND end_date <= start_date
  )
FROM public.external_calendar_actions
ORDER BY table_name;


/* 28 — Longueurs réelles des UID, sans retourner leurs valeurs. */
SELECT
  '28_external_uid_lengths' AS result_set,
  'external_reservation_clients' AS table_name,
  count(*) FILTER (WHERE uid IS NOT NULL) AS non_null_uid_count,
  min(char_length(uid::text)) FILTER (WHERE uid IS NOT NULL) AS min_uid_length,
  max(char_length(uid::text)) FILTER (WHERE uid IS NOT NULL) AS max_uid_length,
  round(avg(char_length(uid::text)) FILTER (WHERE uid IS NOT NULL), 2) AS average_uid_length
FROM public.external_reservation_clients
UNION ALL
SELECT
  '28_external_uid_lengths',
  'external_calendar_actions',
  count(*) FILTER (WHERE uid IS NOT NULL),
  min(char_length(uid::text)) FILTER (WHERE uid IS NOT NULL),
  max(char_length(uid::text)) FILTER (WHERE uid IS NOT NULL),
  round(avg(char_length(uid::text)) FILTER (WHERE uid IS NOT NULL), 2)
FROM public.external_calendar_actions
ORDER BY table_name;


/* 29 — Statuts/actions externes réellement persistés, agrégés. */
SELECT
  '29_external_action_statuses' AS result_set,
  COALESCE(source::text, '[NULL]') AS source_value,
  COALESCE(action::text, '[NULL]') AS action_value,
  COALESCE(alert_status::text, '[NULL]') AS alert_status_value,
  count(*) AS row_count,
  count(*) FILTER (WHERE is_active IS TRUE) AS active_count,
  count(*) FILTER (WHERE is_active IS NOT TRUE) AS inactive_or_null_count
FROM public.external_calendar_actions
GROUP BY source, action, alert_status
ORDER BY source_value, action_value, alert_status_value;


/* 30 — Complétude des enrichissements externes, uniquement en comptages. */
SELECT
  '30_external_enrichment_completeness' AS result_set,
  count(*) AS total_rows,
  count(*) FILTER (WHERE customer_id IS NOT NULL) AS linked_customer_rows,
  count(*) FILTER (
    WHERE btrim(COALESCE(guest_first_name::text, '')) <> ''
       OR btrim(COALESCE(guest_last_name::text, '')) <> ''
  ) AS rows_with_guest_name,
  count(*) FILTER (WHERE btrim(COALESCE(guest_phone::text, '')) <> '') AS rows_with_phone,
  count(*) FILTER (WHERE btrim(COALESCE(guest_email::text, '')) <> '') AS rows_with_email,
  count(*) FILTER (WHERE btrim(COALESCE(notes::text, '')) <> '') AS rows_with_notes,
  count(*) FILTER (WHERE start_date IS NOT NULL AND end_date IS NOT NULL) AS rows_with_complete_period
FROM public.external_reservation_clients;


/* 31 — Clés candidates actuelles pouvant soutenir une FK composite. */
SELECT
  '31_external_composite_candidate_keys' AS result_set,
  n.nspname AS table_schema,
  c.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE' END AS constraint_type,
  string_agg(att.attname, ', ' ORDER BY key_col.ordinality) AS ordered_columns,
  bool_or(att.attname = 'source') AS contains_source,
  bool_or(att.attname IN ('uid', 'external_uid')) AS contains_uid_column
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key_col(attnum, ordinality) ON TRUE
JOIN pg_catalog.pg_attribute att
  ON att.attrelid = c.oid
 AND att.attnum = key_col.attnum
WHERE n.nspname = 'public'
  AND con.contype IN ('p', 'u')
  AND (
    c.relname ~* '(external|ical|calendar)'
    OR c.relname IN ('booking_requests', 'external_occupancies')
  )
GROUP BY n.nspname, c.relname, con.conname, con.contype
HAVING bool_or(att.attname = 'source')
   AND bool_or(att.attname IN ('uid', 'external_uid'))
ORDER BY c.relname, con.conname;


/* 32 — Index uniques candidats, y compris index sans contrainte SQL. */
SELECT
  '32_external_unique_indexes' AS result_set,
  idx.schemaname AS table_schema,
  idx.tablename AS table_name,
  idx.indexname AS index_name,
  regexp_replace(
    regexp_replace(
      idx.indexdef,
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS index_definition_masked
FROM pg_catalog.pg_indexes idx
WHERE idx.schemaname = 'public'
  AND idx.indexdef ~* '^CREATE UNIQUE INDEX'
  AND idx.indexdef ~* '\bsource\b'
  AND idx.indexdef ~* '\b(uid|external_uid)\b'
ORDER BY idx.tablename, idx.indexname;


/* 33 — Types exacts nécessaires aux futures FK housekeeping_notes. */
SELECT
  '33_housekeeping_fk_required_types' AS result_set,
  n.nspname AS parent_schema,
  c.relname AS parent_table,
  att.attname AS parent_column,
  pg_catalog.format_type(att.atttypid, att.atttypmod) AS required_child_postgres_type,
  att.attnotnull AS parent_not_null,
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint con
    WHERE con.conrelid = c.oid
      AND con.contype IN ('p', 'u')
      AND att.attnum = ANY (con.conkey)
  ) AS participates_in_primary_or_unique_constraint
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute att ON att.attrelid = c.oid
WHERE n.nspname = 'public'
  AND (
    (c.relname = 'booking_requests' AND att.attname = 'id')
    OR (c.relname = 'admin_users' AND att.attname = 'id')
    OR (c.relname = 'external_occupancies' AND att.attname = 'id')
  )
  AND att.attnum > 0
  AND NOT att.attisdropped
ORDER BY c.relname, att.attnum;


/* 34 — Colonnes requises par le contrat housekeeping, présence et type. */
SELECT
  '34_housekeeping_contract_columns' AS result_set,
  expected.table_name,
  expected.column_name,
  cols.column_name IS NOT NULL AS exists_now,
  cols.data_type,
  cols.udt_name,
  cols.character_maximum_length,
  cols.is_nullable
FROM (
  SELECT 'booking_requests'::text AS table_name, unnest(ARRAY[
    'id', 'source', 'start_date', 'end_date',
    'guest_first_name', 'guest_last_name', 'guest_phone', 'guest_email',
    'adults_count', 'children_count', 'children_ages', 'baby_bed_needed',
    'arrival_time', 'message', 'housekeeping_notes'
  ]::text[]) AS column_name
  UNION ALL
  SELECT 'external_reservation_clients', unnest(ARRAY[
    'uid', 'source', 'start_date', 'end_date', 'customer_id',
    'guest_first_name', 'guest_last_name', 'guest_phone', 'guest_email',
    'housekeeping_notes'
  ]::text[])
  UNION ALL
  SELECT 'external_calendar_actions', unnest(ARRAY[
    'uid', 'source', 'start_date', 'end_date', 'action', 'is_active',
    'alert_status', 'alert_sent_at'
  ]::text[])
) expected
LEFT JOIN information_schema.columns cols
  ON cols.table_schema = 'public'
 AND cols.table_name = expected.table_name
 AND cols.column_name = expected.column_name
ORDER BY expected.table_name, expected.column_name;


/* 35 — Triggers existants sur les tables concernées, sans les exécuter. */
SELECT
  '35_triggers' AS result_set,
  triggers.event_object_schema AS table_schema,
  triggers.event_object_table AS table_name,
  triggers.trigger_name,
  triggers.action_timing,
  triggers.event_manipulation,
  regexp_replace(
    regexp_replace(
      triggers.action_statement,
      '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}',
      '[EMAIL_MASQUE]',
      'gi'
    ),
    '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}',
    '[UUID_MASQUE]',
    'gi'
  ) AS action_statement_masked,
  triggers.action_orientation
FROM information_schema.triggers triggers
WHERE triggers.event_object_schema = 'public'
  AND triggers.event_object_table = ANY (ARRAY[
    'admin_users',
    'booking_requests',
    'customers',
    'payments',
    'booking_events',
    'email_logs',
    'guest_reviews',
    'site_visits',
    'reservations',
    'stripe_payouts',
    'stripe_balance_transactions',
    'external_reservation_clients',
    'external_calendar_actions',
    'calendar_blocks',
    'pricing_settings',
    'season_prices',
    'price_overrides',
    'external_occupancies',
    'housekeeping_notes'
  ]::text[])
ORDER BY triggers.event_object_table, triggers.trigger_name, triggers.event_manipulation;


/* 36 — Estimation non intrusive du volume des tables concernées. */
SELECT
  '36_table_size_estimates' AS result_set,
  stats.schemaname AS table_schema,
  stats.relname AS table_name,
  stats.n_live_tup AS estimated_live_rows,
  stats.n_dead_tup AS estimated_dead_rows,
  stats.last_analyze,
  stats.last_autoanalyze
FROM pg_catalog.pg_stat_user_tables stats
WHERE stats.schemaname = 'public'
  AND (
    stats.relname = ANY (ARRAY[
      'admin_users',
      'booking_requests',
      'customers',
      'payments',
      'booking_events',
      'email_logs',
      'guest_reviews',
      'site_visits',
      'reservations',
      'stripe_payouts',
      'stripe_balance_transactions',
      'external_reservation_clients',
      'external_calendar_actions',
      'calendar_blocks',
      'pricing_settings',
      'season_prices',
      'price_overrides',
      'external_occupancies',
      'housekeeping_notes'
    ]::text[])
    OR stats.relname ~* '(external|ical|calendar|communication|message|email|log)'
  )
ORDER BY stats.relname;


/* 37 — Inventaire spécifique des tables de communications et logs. */
SELECT
  '37_communication_log_inventory' AS result_set,
  cols.table_schema,
  cols.table_name,
  string_agg(cols.column_name, ', ' ORDER BY cols.ordinal_position) AS columns,
  bool_or(cols.column_name ~* '(message|body|content|subject)') AS has_content_like_column,
  bool_or(cols.column_name ~* '(recipient|to_email|email|phone)') AS has_recipient_like_column,
  bool_or(cols.column_name ~* '(sent|delivered|status|created_at|updated_at)') AS has_delivery_or_time_column,
  bool_or(cols.column_name ~* '(author|actor|user_id|admin_user_id)') AS has_author_like_column
FROM information_schema.columns cols
WHERE cols.table_schema = 'public'
  AND (
    cols.table_name ~* '(communication|message|email|log|history|event)'
    OR cols.column_name ~* '(message_body|message_content|recipient|to_email|sent_at|delivered_at)'
  )
GROUP BY cols.table_schema, cols.table_name
ORDER BY cols.table_name;


/* 38 — Limites explicites d'un audit composé uniquement de SELECT. */
SELECT
  '38_audit_limitations' AS result_set,
  'frontend_direct_access' AS unavailable_information,
  'Les catalogues SQL montrent les grants et policies, mais pas quels composants frontend appellent directement Supabase. Fournir en complément l audit statique du code.' AS explanation
UNION ALL
SELECT
  '38_audit_limitations',
  'effective_policy_simulation_for_each_role',
  'Le script ne change jamais de rôle et ne simule donc pas une session anon/authenticated/service_role. L effet doit être déduit des blocs RLS, policies, grants et propriétés de rôles.'
UNION ALL
SELECT
  '38_audit_limitations',
  'future_absent_table_data',
  'Si external_occupancies ou housekeeping_notes est absente, aucune donnée de cette table future ne peut être auditée sans la créer. Seuls son absence et les types parents nécessaires sont rapportés.'
UNION ALL
SELECT
  '38_audit_limitations',
  'remote_function_runtime_behavior',
  'Le SQL ne prouve pas quelles clés ou quels chemins sont utilisés à l exécution par Netlify. Les droits service_role et le code applicatif doivent être confrontés séparément.';
