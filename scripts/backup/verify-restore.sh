#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:?Usage: verify-restore.sh BACKUP_DIR}"
: "${RESTORE_DB_URL:?RESTORE_DB_URL is required}"

# Safety gate: the caller must explicitly assert this is a disposable/test target.
if [[ "${CONFIRM_TEST_RESTORE:-}" != "YES" && "${ALLOW_PRODUCTION_RESTORE:-}" != "I_ACCEPT_DATA_LOSS_RISK" ]]; then
  echo "Restore blocked. Set CONFIRM_TEST_RESTORE=YES for a disposable test database." >&2
  exit 1
fi

cd "$BACKUP_DIR"
sha256sum -c SHA256SUMS

psql_restore() {
  psql -X --single-transaction --variable ON_ERROR_STOP=1 --dbname="$RESTORE_DB_URL" "$@"
}

# Keep this order: roles -> schema -> Auth users/identities -> public data.
psql_restore --file database/roles.sql
psql_restore --file database/schema.sql
psql_restore --command 'SET session_replication_role = replica' --file database/auth-data.sql
psql_restore --command 'SET session_replication_role = replica' --file database/data.sql

# Migration history is useful for a reconstructed project but restored last.
psql_restore --file database/migration-history-schema.sql --file database/migration-history-data.sql

echo "Database SQL restore completed. Storage objects and platform settings still require the documented restore steps."
