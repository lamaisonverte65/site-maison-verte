#!/usr/bin/env bash
set -euo pipefail

: "${PCLOUD_TOKEN:?PCLOUD_TOKEN is required}"
: "${RCLONE_CRYPT_PASSWORD:?RCLONE_CRYPT_PASSWORD is required}"
: "${RCLONE_CRYPT_PASSWORD2:?RCLONE_CRYPT_PASSWORD2 is required}"

export RCLONE_CONFIG_LMVPCLOUD_TYPE=pcloud
export RCLONE_CONFIG_LMVPCLOUD_TOKEN="$PCLOUD_TOKEN"
export RCLONE_CONFIG_LMVPCLOUD_HOSTNAME=eapi.pcloud.com

CRYPT_ROOT="${PCLOUD_CRYPT_ROOT:-La Maison Verte/Backups_Chiffres}"
export RCLONE_CONFIG_LMVCRYPT_TYPE=crypt
export RCLONE_CONFIG_LMVCRYPT_REMOTE="LMVPCLOUD:${CRYPT_ROOT}"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
export RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true

REMOTE_ROOT="${PCLOUD_BASE_PATH:-01_Supabase}"
NOW_EPOCH="$(date -u +%s)"

purge_old_tier() {
  local tier="$1"
  local retention_days="$2"
  local cutoff=$((NOW_EPOCH - retention_days * 86400))
  local remote="LMVCRYPT:${REMOTE_ROOT}/${tier}"

  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    local name="${entry%/}"
    if [[ ! "$name" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})_([0-9]{2})([0-9]{2})([0-9]{2})Z$ ]]; then
      echo "Skipping unexpected ${tier} directory name: $name" >&2
      continue
    fi
    local stamp="${BASH_REMATCH[1]} ${BASH_REMATCH[2]}:${BASH_REMATCH[3]}:${BASH_REMATCH[4]} UTC"
    local epoch
    epoch="$(date -u -d "$stamp" +%s)"
    if (( epoch < cutoff )); then
      echo "Purging expired ${tier} backup: $name"
      rclone purge "${remote}/${name}"
    fi
  done < <(rclone lsf "$remote" --dirs-only 2>/dev/null || true)
}

# Only short-retention tiers are ever purged automatically.
purge_old_tier daily 30
purge_old_tier weekly 365
