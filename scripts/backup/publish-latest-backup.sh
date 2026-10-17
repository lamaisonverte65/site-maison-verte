#!/usr/bin/env bash
set -euo pipefail

: "${PCLOUD_TOKEN:?PCLOUD_TOKEN is required}"
: "${RCLONE_CRYPT_PASSWORD:?RCLONE_CRYPT_PASSWORD is required}"
: "${RCLONE_CRYPT_PASSWORD2:?RCLONE_CRYPT_PASSWORD2 is required}"

TIER="${1:?Usage: publish-latest-backup.sh TIER BACKUP_ID}"
BACKUP_ID="${2:?Usage: publish-latest-backup.sh TIER BACKUP_ID}"

if [[ ! "$BACKUP_ID" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}Z$ ]]; then
  echo "Invalid BACKUP_ID: $BACKUP_ID" >&2
  exit 1
fi

case "$TIER" in
  daily|weekly|monthly|yearly|manual|baseline) ;;
  *) echo "Invalid backup tier: $TIER" >&2; exit 1 ;;
esac

export RCLONE_CONFIG_LMVPCLOUD_TYPE=pcloud
export RCLONE_CONFIG_LMVPCLOUD_TOKEN="$PCLOUD_TOKEN"
export RCLONE_CONFIG_LMVPCLOUD_HOSTNAME=eapi.pcloud.com

CRYPT_ROOT="${PCLOUD_CRYPT_ROOT:-La Maison Verte/Backups_Chiffres}"
REMOTE_ROOT="${PCLOUD_BASE_PATH:-01_Supabase}"
POINTER_ROOT="${PCLOUD_LATEST_ROOT:-La Maison Verte/backup-download}"

# Keep every configured path relative to its rclone remote. Reject traversal or
# control characters before any external call can resolve a different location.
for path_value in "$CRYPT_ROOT" "$REMOTE_ROOT" "$POINTER_ROOT"; do
  if [[ -z "$path_value" || "$path_value" == /* || "$path_value" == *".."* ||         "$path_value" == *$'\n'* || "$path_value" == *$'\r'* ]]; then
    echo "Invalid encrypted path configuration." >&2
    exit 1
  fi
done

export RCLONE_CONFIG_LMVCRYPT_TYPE=crypt
export RCLONE_CONFIG_LMVCRYPT_REMOTE="LMVPCLOUD:${CRYPT_ROOT}"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
export RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true

# The crypt backend preserves the underlying directory ID. Ask rclone for the
# final logical backup directory directly instead of reconstructing its encrypted
# physical path and querying the pCloud API ourselves.
LOGICAL_PATH="${REMOTE_ROOT}/${TIER}/${BACKUP_ID}"
STAT_JSON="$(rclone lsjson --stat "LMVCRYPT:${LOGICAL_PATH}")"

FOLDER_ID="$(printf '%s' "$STAT_JSON" | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      console.error("Invalid JSON returned by rclone lsjson --stat.");
      process.exit(2);
    }
    const id = String(payload?.ID ?? "").trim();
    if (!payload?.IsDir || !/^d[1-9]\d*$/.test(id)) {
      console.error("rclone stat did not return a valid pCloud directory ID.");
      process.exit(3);
    }
    process.stdout.write(id.slice(1));
  });
')"

LATEST_FILE="$(mktemp)"
trap 'rm -f "$LATEST_FILE"' EXIT
COMPLETED_AT_UTC="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

node - "$BACKUP_ID" "$TIER" "$COMPLETED_AT_UTC" "$FOLDER_ID" > "$LATEST_FILE" <<'NODE'
const [backupId, tier, completedAtUtc, folderId] = process.argv.slice(2);
process.stdout.write(`${JSON.stringify({
  backup_id: backupId,
  tier,
  completed_at_utc: completedAtUtc,
  folder_id: folderId,
}, null, 2)}\n`);
NODE

TMP_REMOTE="LMVPCLOUD:${POINTER_ROOT}/latest.json.tmp"
FINAL_REMOTE="LMVPCLOUD:${POINTER_ROOT}/latest.json"
rclone copyto "$LATEST_FILE" "$TMP_REMOTE"
rclone moveto "$TMP_REMOTE" "$FINAL_REMOTE"
