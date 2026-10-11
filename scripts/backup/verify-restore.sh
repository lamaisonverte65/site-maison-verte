#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:?Usage: verify-restore.sh BACKUP_DIR}"
: "${RESTORE_DB_URL:?RESTORE_DB_URL is required}"
: "${RESTORE_PROJECT_REF:?RESTORE_PROJECT_REF is required}"
: "${SOURCE_PROJECT_REF:?SOURCE_PROJECT_REF is required}"
fail() { echo "$1" >&2; exit 1; }
[[ "${CONFIRM_TEST_RESTORE:-}" == YES ]] || fail 'Only confirmed disposable test restores are allowed.'
[[ "$RESTORE_PROJECT_REF" =~ ^[a-z0-9]+$ && "$SOURCE_PROJECT_REF" =~ ^[a-z0-9]+$ && "$RESTORE_PROJECT_REF" != "$SOURCE_PROJECT_REF" ]] || fail 'Source and test project references must be distinct.'
# Accept only explicit hosted direct/session-pooler URIs; no host/port overrides.
uri_pattern='^postgres(ql)?://([^:@/]+):([^@/?#]+)@([^:/?#]+):5432/postgres([?]sslmode=(require|verify-full))?$'
[[ "$RESTORE_DB_URL" =~ $uri_pattern ]] || fail 'Use a direct or session-pooler URI on port 5432, with an encoded password.'
user="${BASH_REMATCH[2]}"; host="${BASH_REMATCH[4]}"
if [[ "$host" == "db.$RESTORE_PROJECT_REF.supabase.co" ]]; then
  [[ "$user" == postgres ]] || fail 'Unexpected direct connection user.'
else
  [[ "$host" =~ ^aws-[a-z0-9-]+[.]pooler[.]supabase[.]com$ && "$user" == "postgres.$RESTORE_PROJECT_REF" ]] || fail 'Connection does not match the declared test project.'
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BACKUP_DIR"
sha256sum -c SHA256SUMS
covered() {
  awk -v wanted="database/$1" '$2 == wanted || $2 == "./" wanted { found=1 } END { exit !found }' SHA256SUMS || fail "SQL file absent from SHA256SUMS: $1"
}
for file in roles.sql schema.sql data.sql; do
  [[ -s "database/$file" ]] || fail "Missing database/$file"
  covered "$file"
done
history=()
if [[ -e database/migration-history-schema.sql || -e database/migration-history-data.sql ]]; then
  [[ -s database/migration-history-schema.sql && -s database/migration-history-data.sql ]] || fail 'Incomplete migration history pair.'
  covered migration-history-schema.sql
  covered migration-history-data.sql
  history=(--file database/migration-history-schema.sql --file database/migration-history-data.sql)
else
  echo 'Migration history files absent: restore continues without supabase_migrations history.'
fi
umask 077
prepared="$(mktemp)"
trap 'rm -f -- "$prepared"' EXIT
awk -f "$SCRIPT_DIR/prepare-restore-data.awk" database/data.sql > "$prepared"
# Read-only gate rejects the previous partially restored test project.
count="$(psql -X -At --variable ON_ERROR_STOP=1 --dbname="$RESTORE_DB_URL" --command "SELECT count(*) FROM (SELECT tablename FROM pg_tables WHERE schemaname = 'public' UNION ALL SELECT id::text FROM auth.users UNION ALL SELECT id::text FROM storage.buckets UNION ALL SELECT id::text FROM storage.objects) AS existing;")"
[[ "$count" == 0 ]] || fail 'Target is not empty. Create a NEW disposable Supabase project; do not resume this restore.'
# One connection/transaction for all SQL; redundant legacy auth-data.sql is never loaded.
psql -X --single-transaction --variable ON_ERROR_STOP=1 --dbname="$RESTORE_DB_URL" \
  --file database/roles.sql --file database/schema.sql \
  --command 'SET session_replication_role = replica' --file "$prepared" \
  "${history[@]}"
echo 'Database SQL restore completed. Storage API restore and business validation are still required.'
