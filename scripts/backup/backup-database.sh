#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

OUT="$BACKUP_DIR/database"
mkdir -p "$OUT"

supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/roles.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/schema.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/data.sql" \
  --use-copy --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

# The normal Supabase dump excludes managed auth/storage schemas. Auth data is
# archived separately so users/identities are not lost in a disaster recovery.
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/auth-data.sql" \
  --schema auth --use-copy --data-only

# Preserve the remote migration history in addition to the migration files in Git.
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/migration-history-schema.sql" \
  --schema supabase_migrations
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$OUT/migration-history-data.sql" \
  --schema supabase_migrations --use-copy --data-only
