#!/usr/bin/env bash
set -euo pipefail

: "${PCLOUD_TOKEN:?PCLOUD_TOKEN is required}"
: "${RCLONE_CRYPT_PASSWORD:?RCLONE_CRYPT_PASSWORD is required}"
: "${RCLONE_CRYPT_PASSWORD2:?RCLONE_CRYPT_PASSWORD2 is required}"

BACKUP_DIR="${1:?Usage: upload-pcloud.sh BACKUP_DIR TIER BACKUP_ID}"
TIER="${2:?Usage: upload-pcloud.sh BACKUP_DIR TIER BACKUP_ID}"
BACKUP_ID="${3:?Usage: upload-pcloud.sh BACKUP_DIR TIER BACKUP_ID}"

if [[ ! "$BACKUP_ID" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}Z$ ]]; then
  echo "Invalid BACKUP_ID: $BACKUP_ID" >&2
  exit 1
fi

case "$TIER" in
  daily|weekly|monthly|yearly|manual|baseline) ;;
  *) echo "Invalid backup tier: $TIER" >&2; exit 1 ;;
esac

[[ -d "$BACKUP_DIR" ]] || { echo "Backup directory not found: $BACKUP_DIR" >&2; exit 1; }
[[ -s "$BACKUP_DIR/SHA256SUMS" ]] || { echo "Backup has no SHA256SUMS" >&2; exit 1; }

# Underlying pCloud EU remote. Nothing in the backup is written directly here:
# every backup operation below goes through LMVCRYPT.
export RCLONE_CONFIG_LMVPCLOUD_TYPE=pcloud
export RCLONE_CONFIG_LMVPCLOUD_TOKEN="$PCLOUD_TOKEN"
export RCLONE_CONFIG_LMVPCLOUD_HOSTNAME=eapi.pcloud.com

# Client-side encryption. rclone requires password/password2 in obscured form
# (values generated with `rclone obscure` and stored as GitHub Actions secrets).
CRYPT_ROOT="${PCLOUD_CRYPT_ROOT:-La Maison Verte/Backups_Chiffres}"
export RCLONE_CONFIG_LMVCRYPT_TYPE=crypt
export RCLONE_CONFIG_LMVCRYPT_REMOTE="LMVPCLOUD:${CRYPT_ROOT}"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
export RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true

# This path is logical/decrypted. Its directory and file names are encrypted
# before pCloud sees them.
REMOTE_ROOT="${PCLOUD_BASE_PATH:-01_Supabase}"

# A baseline is valid only when its encrypted _SUCCESS marker can be read back
# through LMVCRYPT. A prior interrupted upload does not block a real baseline.
if [[ "$TIER" == "baseline" ]]; then
  existing_success="$(rclone lsf "LMVCRYPT:${REMOTE_ROOT}/baseline" --recursive --files-only 2>/dev/null \
    | grep -E '(^|/)_SUCCESS$' || true)"
  if [[ -n "$existing_success" ]]; then
    echo "A completed baseline already exists on encrypted pCloud storage; refusing another baseline." >&2
    exit 1
  fi
fi

REMOTE="LMVCRYPT:${REMOTE_ROOT}/${TIER}/${BACKUP_ID}"
STAGING="LMVCRYPT:${REMOTE_ROOT}/.incoming/${TIER}/${BACKUP_ID}"
SUCCESS_FILE="$(mktemp)"
trap 'rm -f "$SUCCESS_FILE"' EXIT
printf 'backup_id=%s\ntier=%s\ncompleted_at_utc=%s\n' \
  "$BACKUP_ID" "$TIER" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" > "$SUCCESS_FILE"

# Phase 1: encrypted upload to a non-authoritative staging path and cryptographic
# integrity verification against the local source.
rclone purge "$STAGING" 2>/dev/null || true
rclone copy "$BACKUP_DIR" "$STAGING" --create-empty-src-dirs
rclone cryptcheck "$BACKUP_DIR" "$STAGING" --one-way

# Phase 2: promote through the crypt remote, verify again, then mark valid.
rclone copy "$STAGING" "$REMOTE" --create-empty-src-dirs
rclone cryptcheck "$BACKUP_DIR" "$REMOTE" --one-way
rclone copyto "$SUCCESS_FILE" "$REMOTE/_SUCCESS"
rclone purge "$STAGING"
