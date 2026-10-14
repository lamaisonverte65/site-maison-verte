#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_DIR="${1:-${CONTRACTS_ARCHIVE_DIR:-}}"
REMOTE_ROOT="${PCLOUD_DOCUMENTS_PATH:-03_Documents/contrats}"
REMOTE="LMVCRYPT:${REMOTE_ROOT}"

if [[ -z "$ARCHIVE_DIR" || ! -d "$ARCHIVE_DIR" ]]; then
  echo "Contract archive directory missing: ${ARCHIVE_DIR:-<empty>}" >&2
  exit 1
fi
for required in manifest.json SHA256SUMS; do
  [[ -s "$ARCHIVE_DIR/$required" ]] || { echo "Missing $required" >&2; exit 1; }
done

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

mapfile -t local_pdfs < <(find "$ARCHIVE_DIR" -maxdepth 1 -type f -name 'contrat-location-V*.pdf' -printf '%f\n' | sort -V)
if [[ ${#local_pdfs[@]} -eq 0 ]]; then
  echo "No versioned contract PDF to archive" >&2
  exit 1
fi

# Every previously archived version must still exist locally.
mapfile -t remote_pdfs < <(rclone lsf "$REMOTE" --files-only --include 'contrat-location-V*.pdf' 2>/dev/null | sed 's#/$##' | sort -V || true)
for name in "${remote_pdfs[@]}"; do
  [[ -f "$ARCHIVE_DIR/$name" ]] || {
    echo "Missing previously archived contract in local archive: $name" >&2
    exit 1
  }
done

# Invalidate success before any mutation; recreate only after full verification.
rclone deletefile "$REMOTE/_SUCCESS" 2>/dev/null || true

# Historical PDFs are immutable:
# - existing + identical: do not rewrite it;
# - existing + different: fail;
# - absent: upload it once.
for name in "${local_pdfs[@]}"; do
  file="$ARCHIVE_DIR/$name"

  if printf '%s\n' "${remote_pdfs[@]}" | grep -Fxq "$name"; then
    if rclone cryptcheck "$ARCHIVE_DIR" "$REMOTE" --include "$name" >/dev/null 2>&1; then
      echo "Immutable contract already archived and identical: $name"
      continue
    fi

    echo "Immutable contract differs from archived version: $name" >&2
    exit 1
  fi

  rclone copyto "$file" "$REMOTE/$name" --immutable
done

# Small metadata files may evolve when a new contract version is added.
# Avoid touching them when their decrypted contents are already identical.
for name in manifest.json SHA256SUMS; do
  file="$ARCHIVE_DIR/$name"

  if rclone cat "$REMOTE/$name" 2>/dev/null | cmp -s "$file" -; then
    echo "Metadata already identical: $name"
  else
    rclone copyto "$file" "$REMOTE/$name"
  fi
done

rclone cryptcheck "$ARCHIVE_DIR" "$REMOTE" \
  --include 'contrat-location-V*.pdf' \
  --include 'manifest.json' \
  --include 'SHA256SUMS'

printf 'ok\n' | rclone rcat "$REMOTE/_SUCCESS"
echo "Contract archive verified and published: $REMOTE"
