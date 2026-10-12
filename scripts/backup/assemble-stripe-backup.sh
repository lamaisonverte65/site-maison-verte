#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_ID:?BACKUP_ID is required}"
: "${BACKUP_KIND:?BACKUP_KIND is required}"
: "${STRIPE_BACKUP_KEY:?STRIPE_BACKUP_KEY is required}"
: "${STRIPE_EXPECTED_ACCOUNT_ID:?STRIPE_EXPECTED_ACCOUNT_ID is required}"

if [[ -d "$BACKUP_DIR" ]] && [[ -n "$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
  echo "BACKUP_DIR must be empty before assembling a Stripe backup." >&2
  exit 1
fi
mkdir -p "$BACKUP_DIR"

node "$SCRIPT_DIR/backup-stripe.mjs"
node "$SCRIPT_DIR/build-stripe-manifest.mjs" "$BACKUP_DIR"

(
  cd "$BACKUP_DIR"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 sha256sum > SHA256SUMS
)

[[ -s "$BACKUP_DIR/manifest.json" ]] || { echo "Stripe backup has no manifest.json" >&2; exit 1; }
[[ -s "$BACKUP_DIR/SHA256SUMS" ]] || { echo "Stripe backup has no SHA256SUMS" >&2; exit 1; }
