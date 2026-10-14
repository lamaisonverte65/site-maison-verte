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

PCLOUD_AUTH_TOKEN="$(printf '%s' "$PCLOUD_TOKEN" | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => {
    const value = input.trim();
    if (!value) process.exit(2);
    if (!value.startsWith("{")) { process.stdout.write(value); return; }
    let parsed;
    try { parsed = JSON.parse(value); } catch { process.exit(3); }
    const accessToken = String(parsed?.access_token ?? "").trim();
    if (!accessToken) process.exit(4);
    process.stdout.write(accessToken);
  });
')"

CRYPT_ROOT="${PCLOUD_CRYPT_ROOT:-La Maison Verte/Backups_Chiffres}"
REMOTE_ROOT="${PCLOUD_BASE_PATH:-01_Supabase}"
POINTER_ROOT="${PCLOUD_LATEST_ROOT:-La Maison Verte/backup-download}"

export RCLONE_CONFIG_LMVCRYPT_TYPE=crypt
export RCLONE_CONFIG_LMVCRYPT_REMOTE="LMVPCLOUD:${CRYPT_ROOT}"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
export RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true

LOGICAL_PATH="${REMOTE_ROOT}/${TIER}/${BACKUP_ID}"
ENCODED_LINE="$(rclone cryptdecode --reverse "LMVCRYPT:" "$LOGICAL_PATH")"
ENCRYPTED_RELATIVE="$(printf '%s\n' "$ENCODED_LINE" | cut -f2- | sed 's/^[[:space:]]*//')"

if [[ -z "$ENCRYPTED_RELATIVE" || "$ENCRYPTED_RELATIVE" == /* || "$ENCRYPTED_RELATIVE" == *".."* ]]; then
  echo "Invalid encrypted path returned by rclone." >&2
  exit 1
fi

PHYSICAL_PATH="/${CRYPT_ROOT}/${ENCRYPTED_RELATIVE}"
LIST_JSON="$(curl --silent --show-error --fail-with-body \
  --data-urlencode "auth=${PCLOUD_AUTH_TOKEN}" \
  --data-urlencode "path=${PHYSICAL_PATH}" \
  --data-urlencode "nofiles=1" \
  https://eapi.pcloud.com/listfolder)"

FOLDER_ID="$(printf '%s' "$LIST_JSON" | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { input += chunk; });
  process.stdin.on("end", () => {
    let payload;
    try {
      const exactIds = input.replace(/("folderid"\s*:\s*)(\d+)/g, "$1\"$2\"");
      payload = JSON.parse(exactIds);
    } catch { process.exit(2); }
    const id = String(payload?.metadata?.folderid ?? "");
    if (payload?.result !== 0 || !payload?.metadata?.isfolder || !/^[1-9]\d*$/.test(id)) process.exit(3);
    process.stdout.write(id);
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
