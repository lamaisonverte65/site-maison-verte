#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

OUT="$BACKUP_DIR/inventory"
mkdir -p "$OUT"

psql_tsv() {
  local sql="$1"
  psql -X -q -v ON_ERROR_STOP=1 --dbname="$SUPABASE_DB_URL" -A -t -F $'\t' -c "$sql"
}

psql_json() {
  local sql="$1"
  psql -X -q -v ON_ERROR_STOP=1 --dbname="$SUPABASE_DB_URL" -A -t -c "$sql"
}

psql_tsv "
SELECT table_schema,
       table_name,
       format('%I.%I', table_schema, table_name)
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
" > "$OUT/public_tables.tsv"

psql_tsv "
SELECT e.extname, e.extversion, n.nspname
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;
" > "$OUT/extensions.tsv"

psql_tsv "
SELECT n.nspname,
       p.proname,
       pg_get_function_identity_arguments(p.oid),
       pg_get_function_result(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
" > "$OUT/functions.tsv"

psql_tsv "
SELECT n.nspname,
       c.relname,
       t.tgname,
       pg_get_triggerdef(t.oid, true)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND n.nspname IN ('public', 'auth', 'storage')
ORDER BY n.nspname, c.relname, t.tgname;
" > "$OUT/triggers.tsv"

psql_tsv "
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles::text,
       cmd,
       coalesce(qual, ''),
       coalesce(with_check, '')
FROM pg_policies
WHERE schemaname IN ('public', 'auth', 'storage')
ORDER BY schemaname, tablename, policyname;
" > "$OUT/policies.tsv"

psql_tsv "
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;
" > "$OUT/auth_tables.tsv"

psql_tsv "
SELECT 'users', count(*)::text FROM auth.users
UNION ALL
SELECT 'identities', count(*)::text FROM auth.identities
ORDER BY 1;
" > "$OUT/auth_summary.tsv"

psql_json "
SELECT coalesce(
  jsonb_agg(to_jsonb(b) ORDER BY b.id),
  '[]'::jsonb
)::text
FROM storage.buckets b;
" > "$OUT/storage_buckets.json"
printf '\n' >> "$OUT/storage_buckets.json"

psql_json "
SELECT coalesce(
  jsonb_agg(
    jsonb_build_object(
      'bucket_id', o.bucket_id,
      'name', o.name,
      'metadata', o.metadata,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'last_accessed_at', o.last_accessed_at
    ) ORDER BY o.bucket_id, o.name
  ),
  '[]'::jsonb
)::text
FROM storage.objects o;
" > "$OUT/storage_objects.json"
printf '\n' >> "$OUT/storage_objects.json"

# Human-readable summaries; JSON remains the authoritative Storage inventory.
psql_tsv "
SELECT id, name, public::text, coalesce(file_size_limit::text, ''), coalesce(array_to_string(allowed_mime_types, ','), '')
FROM storage.buckets
ORDER BY id;
" > "$OUT/storage_buckets.tsv"

psql_tsv "
SELECT bucket_id, name, coalesce(metadata->>'size', '')
FROM storage.objects
ORDER BY bucket_id, name;
" > "$OUT/storage_objects.tsv"

if [[ "$(psql_tsv "SELECT CASE WHEN to_regclass('vault.secrets') IS NULL THEN 'absent' ELSE 'present' END;")" == "present" ]]; then
  psql_tsv "SELECT 'vault.secrets', count(*)::text FROM vault.secrets;" > "$OUT/vault_summary.tsv"
else
  printf 'vault.secrets\tabsent\n' > "$OUT/vault_summary.tsv"
fi
