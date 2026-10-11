#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

INVENTORY="$BACKUP_DIR/inventory/public_tables.tsv"
OUT="$BACKUP_DIR/exports/public"
COUNTS="$BACKUP_DIR/inventory/public_table_counts.tsv"
mkdir -p "$OUT"
: > "$COUNTS"

[[ -f "$INVENTORY" ]] || { echo "Missing inventory: $INVENTORY" >&2; exit 1; }

while IFS=$'\t' read -r schema table qualified; do
  [[ -n "$schema" && -n "$table" && -n "$qualified" ]] || continue

  base="$(printf '%s.%s' "$schema" "$table" | sed -E 's/[^A-Za-z0-9._-]+/_/g')"
  suffix="$(printf '%s.%s' "$schema" "$table" | sha256sum | cut -c1-8)"
  filename="${base}_${suffix}.csv"
  destination="$OUT/$filename"

  count="$(psql -X -q -v ON_ERROR_STOP=1 --dbname="$SUPABASE_DB_URL" -A -t \
    -c "SELECT count(*) FROM ${qualified};")"

  psql -X -q -v ON_ERROR_STOP=1 --dbname="$SUPABASE_DB_URL" \
    -c "COPY ${qualified} TO STDOUT WITH (FORMAT CSV, HEADER TRUE)" > "$destination"

  printf '%s\t%s\t%s\t%s\n' "$schema" "$table" "$count" "$filename" >> "$COUNTS"
done < "$INVENTORY"
