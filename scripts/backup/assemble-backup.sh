#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_DIR:?BACKUP_DIR is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

mkdir -p "$BACKUP_DIR"
if find "$BACKUP_DIR" -mindepth 1 -print -quit | grep -q .; then
  echo "Refusing to assemble into a non-empty BACKUP_DIR: $BACKUP_DIR" >&2
  exit 1
fi

bash "$SCRIPT_DIR/supabase-inventory.sh"
bash "$SCRIPT_DIR/backup-database.sh"
bash "$SCRIPT_DIR/export-public-tables.sh"
node "$SCRIPT_DIR/backup-storage.mjs"

mkdir -p "$BACKUP_DIR/migrations"
cp -a "$REPO_ROOT/supabase/migrations/." "$BACKUP_DIR/migrations/"

for critical in \
  "$BACKUP_DIR/database/roles.sql" \
  "$BACKUP_DIR/database/schema.sql" \
  "$BACKUP_DIR/database/data.sql" \
  "$BACKUP_DIR/database/auth-data.sql" \
  "$BACKUP_DIR/inventory/public_tables.tsv" \
  "$BACKUP_DIR/inventory/storage_buckets.json" \
  "$BACKUP_DIR/inventory/storage_objects.json"; do
  test -s "$critical" || { echo "Critical backup file missing or empty: $critical" >&2; exit 1; }
done

# Migration history is optional because some hosted projects do not expose the
# supabase_migrations schema. If one history file exists, require the pair.
MIGRATION_HISTORY_SCHEMA="$BACKUP_DIR/database/migration-history-schema.sql"
MIGRATION_HISTORY_DATA="$BACKUP_DIR/database/migration-history-data.sql"
if [[ -e "$MIGRATION_HISTORY_SCHEMA" || -e "$MIGRATION_HISTORY_DATA" ]]; then
  test -s "$MIGRATION_HISTORY_SCHEMA" || { echo "Migration history schema file missing or empty: $MIGRATION_HISTORY_SCHEMA" >&2; exit 1; }
  test -s "$MIGRATION_HISTORY_DATA" || { echo "Migration history data file missing or empty: $MIGRATION_HISTORY_DATA" >&2; exit 1; }
fi

node "$SCRIPT_DIR/build-manifest.mjs" "$BACKUP_DIR"

(
  cd "$BACKUP_DIR"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 sha256sum > SHA256SUMS
)

test -s "$BACKUP_DIR/manifest.json"
test -s "$BACKUP_DIR/SHA256SUMS"
