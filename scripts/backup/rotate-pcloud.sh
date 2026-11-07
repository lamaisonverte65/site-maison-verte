#!/usr/bin/env bash
set -euo pipefail

# R31.1 — Safe retention. Dry-run is the default, including GitHub Actions.
# Explicit --apply and R31_ROTATION_APPLY_ACK are required for remote deletion.
MODE="${1:---dry-run}"
case "$MODE" in
  --dry-run|--apply) ;;
  *) echo "Usage: rotate-pcloud.sh [--dry-run|--apply]" >&2; exit 2 ;;
esac
if [[ "$MODE" == '--apply' && "${R31_ROTATION_APPLY_ACK:-}" != 'JE_CONFIRME_LA_ROTATION_R31' ]]; then
  echo 'Blocked: --apply requires R31_ROTATION_APPLY_ACK=JE_CONFIRME_LA_ROTATION_R31' >&2
  exit 2
fi

: "${PCLOUD_TOKEN:?PCLOUD_TOKEN is required}"
: "${RCLONE_CRYPT_PASSWORD:?RCLONE_CRYPT_PASSWORD is required}"
: "${RCLONE_CRYPT_PASSWORD2:?RCLONE_CRYPT_PASSWORD2 is required}"

export RCLONE_CONFIG_LMVPCLOUD_TYPE=pcloud
export RCLONE_CONFIG_LMVPCLOUD_TOKEN="$PCLOUD_TOKEN"
export RCLONE_CONFIG_LMVPCLOUD_HOSTNAME=eapi.pcloud.com
CRYPT_ROOT="${PCLOUD_CRYPT_ROOT:-La Maison Verte/Backups_Chiffres}"
REMOTE_ROOT="${PCLOUD_BASE_PATH:-01_Supabase}"
POINTER_ROOT="${PCLOUD_LATEST_ROOT:-La Maison Verte/backup-download}"

# Never allow the rotating script to be redirected to unrelated folders.
case "$REMOTE_ROOT" in 01_Supabase|02_Stripe) ;; *) echo 'Invalid PCLOUD_BASE_PATH' >&2; exit 2 ;; esac
for path_value in "$CRYPT_ROOT" "$POINTER_ROOT"; do
  if [[ -z "$path_value" || "$path_value" == /* || "$path_value" == *'..'* || "$path_value" == *$'\n'* || "$path_value" == *$'\r'* ]]; then
    echo 'Invalid backup path configuration' >&2
    exit 2
  fi
done
export RCLONE_CONFIG_LMVCRYPT_TYPE=crypt
export RCLONE_CONFIG_LMVCRYPT_REMOTE="LMVPCLOUD:${CRYPT_ROOT}"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
export RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true

# A valid latest pointer is mandatory for deletion. A failed read must never
# silently turn into a permissive retention plan.
POINTER_JSON="$(rclone cat "LMVPCLOUD:${POINTER_ROOT}/latest.json")" || {
  echo 'Cannot read latest backup pointer: rotation aborted' >&2
  exit 1
}
POINTER_FIELDS="$(printf '%s' "$POINTER_JSON" | node -e '
  let data="";
  process.stdin.on("data", chunk => data+=chunk);
  process.stdin.on("end", () => {
    let p;
    try { p=JSON.parse(data); } catch { process.exit(1); }
    if (!/^(daily|weekly|monthly|yearly|manual|baseline)$/.test(p?.tier ?? "") ||
        !/^\d{4}-\d{2}-\d{2}_\d{6}Z$/.test(p?.backup_id ?? "")) process.exit(1);
    process.stdout.write(`${p.tier} ${p.backup_id}`);
  });
')" || { echo 'Invalid latest backup pointer: rotation aborted' >&2; exit 1; }
read -r POINTER_TIER POINTER_ID <<< "$POINTER_FIELDS"

# Read the root and tiers once, without swallowing failures.
ROOT_LIST="$(rclone lsf "LMVCRYPT:${REMOTE_ROOT}" --dirs-only --max-depth 1)" || {
  echo 'Cannot list backup root: rotation aborted' >&2
  exit 1
}

# A separate completed baseline is a safety anchor for this account. No
# deletion without one; the baseline itself is never a deletion candidate.
if ! grep -Fxq 'baseline/' <<< "$ROOT_LIST"; then
  echo 'No baseline directory: deletion disabled' >&2
  [[ "$MODE" == '--dry-run' ]] || exit 1
fi

# Return 0 only for an uploaded and marked successful package. Broken or
# partial backups are kept for manual inspection (not counted or deleted).
valid_backup() {
  local tier="$1" id="$2"
  local folder="LMVCRYPT:${REMOTE_ROOT}/${tier}/${id}"
  local marker file_list
  marker="$(rclone cat "$folder/_SUCCESS" 2>/dev/null)" || return 1
  grep -Fxq "backup_id=${id}" <<< "$marker" || return 1
  grep -Fxq "tier=${tier}" <<< "$marker" || return 1
  file_list="$(rclone lsf "$folder" --files-only --max-depth 1 2>/dev/null)" || return 1
  grep -Fxq 'SHA256SUMS' <<< "$file_list" || return 1
  grep -Fxq 'manifest.json' <<< "$file_list" || return 1
  return 0
}

# Prevent purging anything until there is at least one verified baseline.
BASELINE_OK=0
if grep -Fxq 'baseline/' <<< "$ROOT_LIST"; then
  BASELINE_LIST="$(rclone lsf "LMVCRYPT:${REMOTE_ROOT}/baseline" --dirs-only --max-depth 1)" || {
    echo 'Cannot list baselines: rotation aborted' >&2; exit 1;
  }
  while IFS= read -r entry; do
    id="${entry%/}"
    if [[ "$id" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}Z$ ]] && valid_backup baseline "$id"; then
      BASELINE_OK=1
      break
    fi
  done <<< "$BASELINE_LIST"
fi
if (( BASELINE_OK == 0 )); then
  echo 'No verified baseline: deletion disabled' >&2
  [[ "$MODE" == '--dry-run' ]] || exit 1
fi

# The published latest backup must itself be valid before considering a purge.
if ! valid_backup "$POINTER_TIER" "$POINTER_ID"; then
  echo 'Latest backup pointer refers to an unverified backup: rotation aborted' >&2
  exit 1
fi

# First build a complete plan: any listing failure aborts before the first purge.
TO_DELETE=()

# Only these tiers are eligible. Manual, yearly, baseline, .incoming and all
# documents are excluded by construction.
for specification in 'daily:7' 'weekly:4' 'monthly:2'; do
  tier="${specification%%:*}"
  keep="${specification#*:}"
  if ! grep -Fxq "${tier}/" <<< "$ROOT_LIST"; then
    echo "SKIP: no ${REMOTE_ROOT}/${tier} directory"
    continue
  fi

  listing="$(rclone lsf "LMVCRYPT:${REMOTE_ROOT}/${tier}" --dirs-only --max-depth 1)" || {
    echo "Cannot list ${tier}: rotation aborted" >&2; exit 1;
  }
  verified=()
  while IFS= read -r entry; do
    [[ -n "$entry" ]] || continue
    id="${entry%/}"
    if [[ ! "$id" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}Z$ ]]; then
      echo "SKIP: unexpected name in ${tier}: ${id}"
      continue
    fi
    # Reject impossible timestamp strings, even if they match the regex.
    stamp="${id:0:10} ${id:11:2}:${id:13:2}:${id:15:2} UTC"
    if ! date -u -d "$stamp" '+%Y-%m-%d_%H%M%SZ' 2>/dev/null | grep -Fxq "$id"; then
      echo "SKIP: invalid timestamp in ${tier}: ${id}"
      continue
    fi
    if valid_backup "$tier" "$id"; then
      verified+=("$id")
    else
      echo "SKIP: unverified backup ${tier}/${id} (protected)"
    fi
  done <<< "$listing"

  if (( ${#verified[@]} <= keep )); then
    echo "KEEP: ${REMOTE_ROOT}/${tier} (${#verified[@]} verified, <= ${keep})"
    continue
  fi

  # Validated lexical date order: newest first. Maintain N verified copies.
  mapfile -t ordered < <(printf '%s\n' "${verified[@]}" | LC_ALL=C sort -r)
  for (( i=0; i<${#ordered[@]}; i++ )); do
    id="${ordered[i]}"
    folder="LMVCRYPT:${REMOTE_ROOT}/${tier}/${id}"
    if (( i < keep )) || { [[ "$tier" == "$POINTER_TIER" && "$id" == "$POINTER_ID" ]]; }; then
      echo "KEEP: ${tier}/${id}"
      continue
    fi
    if (( BASELINE_OK == 0 )); then
      echo "BLOCKED: ${tier}/${id} (no verified baseline)"
      continue
    fi
    if [[ "$MODE" == '--dry-run' ]]; then
      echo "WOULD_DELETE: ${tier}/${id}"
    else
      TO_DELETE+=("$folder")
      echo "PLANNED_DELETE: ${tier}/${id}"
    fi
  done
done

if [[ "$MODE" == '--apply' ]]; then
  # A bounded batch prevents accidental massive deletion from a bad inventory.
  if (( ${#TO_DELETE[@]} > 25 )); then
    echo "Too many deletions in one run (${#TO_DELETE[@]} > 25): aborted" >&2
    exit 1
  fi
  for folder in "${TO_DELETE[@]}"; do
    echo "DELETE: ${folder}"
    rclone purge "$folder"
  done
fi

echo "Rotation complete: ${MODE}, root=${REMOTE_ROOT}; manual/yearly/baseline untouched"
