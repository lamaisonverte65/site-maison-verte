#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# R31.5 : ne gere QUE LMVCRYPT:R315_VERSIONS et la lecture de R315_SOURCES.
# Interdit toute purge des anciennes racines R31.2, de R315_SOURCES ou de la racine crypt.
: "${PCLOUD_TOKEN:?Secret PCLOUD_TOKEN manquant}"
: "${RCLONE_CRYPT_PASSWORD:?Secret RCLONE_CRYPT_PASSWORD manquant}"
: "${RCLONE_CRYPT_PASSWORD2:?Secret RCLONE_CRYPT_PASSWORD2 manquant}"

if (( $# != 2 )); then
  echo 'Usage: r315-cloud-rolling.sh DOSSIER_CHIFFRE BACKUP_ID' >&2
  exit 2
fi
LOCAL="${1%/}"
ID="$2"
[[ "$ID" =~ ^20[0-9]{2}-[01][0-9]-[0-3][0-9]_[0-2][0-9][0-5][0-9][0-5][0-9]Z$ ]] || { echo 'Identifiant non conforme' >&2; exit 2; }
[[ -d "$LOCAL" ]] || { echo 'Dossier local inexistant' >&2; exit 2; }
for file in 01_Supabase.tar.gz.age 02_Stripe.tar.gz.age SHA256_ENCRYPTED.txt INFO.txt; do
  [[ -s "$LOCAL/$file" ]] || { echo "Fichier manquant : $file" >&2; exit 2; }
done
( cd "$LOCAL" && sha256sum --check SHA256_ENCRYPTED.txt --status ) || {
  echo 'SHA256 local non conforme' >&2; exit 2;
}
grep -Fxq "backup_id=$ID" "$LOCAL/INFO.txt" || { echo 'INFO.txt ne correspond pas au backup_id' >&2; exit 2; }
for f in 01_Supabase.tar.gz.age 02_Stripe.tar.gz.age; do
  head -c 64 "$LOCAL/$f" | grep -Fq 'age-encryption.org/v1' || { echo "Archive age non reconnue : $f" >&2; exit 2; }
done

# Configuration identique aux sauvegardes R31.2 (secrets GitHub existants).
export RCLONE_CONFIG_LMVPCLOUD_TYPE=pcloud
export RCLONE_CONFIG_LMVPCLOUD_TOKEN="$PCLOUD_TOKEN"
export RCLONE_CONFIG_LMVPCLOUD_HOSTNAME=eapi.pcloud.com
export RCLONE_CONFIG_LMVCRYPT_TYPE=crypt
export RCLONE_CONFIG_LMVCRYPT_REMOTE='LMVPCLOUD:La Maison Verte/Backups_Chiffres'
export RCLONE_CONFIG_LMVCRYPT_PASSWORD="$RCLONE_CRYPT_PASSWORD"
export RCLONE_CONFIG_LMVCRYPT_PASSWORD2="$RCLONE_CRYPT_PASSWORD2"
export RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard
export RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true

ROOT='LMVCRYPT:R315_VERSIONS'
STAGING="$ROOT/.incoming/current"
FINAL="$ROOT/$ID"
SEED='2026-11-24_150933Z'
SOURCE_ZIP='LMV_SITE_SOURCES_DEPLOYEES_b012855_2026-11-24_09-52-53.zip'
SOURCE_EXPECTED_SHA='0e12a3c2bd318617e51be8f0356c385ca1be60d99ca4fc49b213ec7be162abae'
SOURCE_REMOTE="LMVCRYPT:R315_SOURCES/b012855/$SOURCE_ZIP"

# Refuse tout mauvais remote / toute racine vide ou inconnue.
root_entries="$(rclone lsf "$ROOT" --dirs-only --max-depth 1 --retries 5)" || {
  echo 'La racine R315_VERSIONS est inaccessible : abandon sans suppression.' >&2; exit 1;
}
[[ -n "$root_entries" ]] || { echo 'La racine R315_VERSIONS est vide : abandon.' >&2; exit 1; }
if grep -Fxq "$ID/" <<< "$root_entries"; then
  echo 'Destination de ce backup_id deja presente : aucun ecrasement.' >&2
  exit 1
fi

# Seul l'emplacement de transit non valide peut etre purge avant le transfert.
echo 'Suppression eventuelle du seul transit .incoming/current (jamais une sauvegarde valide).'
rclone purge "$STAGING" --retries 5 2>/dev/null || {
  # Un sous-dossier absent est normal ; un autre echec n'est pas ignore.
  existing="$(rclone lsf "$ROOT/.incoming" --dirs-only --max-depth 1 2>/dev/null || true)"
  if grep -Fxq 'current/' <<< "$existing"; then
    echo 'Transit non purge : abandon.' >&2; exit 1
  fi
}

# Phase 1 : ecriture du transit, puis relecture integrale depuis le serveur.
echo '1/4 : copie chiffre -> .incoming/current'
rclone copy "$LOCAL" "$STAGING" --transfers 1 --checkers 2 --retries 5 --low-level-retries 10 --stats 10s
rclone check "$LOCAL" "$STAGING" --download --one-way --checkers 2 --retries 5

# Phase 2 : publication sous un nom horodate, relecture, puis marqueur de succes.
echo '2/4 : publication, relecture et verification SHA256'
rclone copy "$STAGING" "$FINAL" --transfers 1 --checkers 2 --retries 5 --low-level-retries 10 --stats 10s
rclone check "$LOCAL" "$FINAL" --download --one-way --checkers 2 --retries 5

marker="$(mktemp)"
verify_base="$(mktemp -d)"
trap 'rm -f "$marker"; rm -rf "$verify_base"' EXIT
manifest_sha="$(sha256sum "$LOCAL/SHA256_ENCRYPTED.txt" | awk '{print $1}')"
printf 'format=R315_AGE_V1\nbackup_id=%s\nsha256_manifest=%s\n' "$ID" "$manifest_sha" > "$marker"
rclone copyto "$marker" "$FINAL/_SUCCESS" --retries 5
returned_marker="$(rclone cat "$FINAL/_SUCCESS" --retries 5)"
[[ "$returned_marker" == "$(cat "$marker")" ]] || { echo 'Marqueur distant incorrect' >&2; exit 1; }
echo "VALIDEE : $FINAL"

# Retirer le transit uniquement apres publication reussie.
rclone purge "$STAGING" --retries 5

# Phase 3 : identification des versions terminees et protegees.
echo '3/4 : examen de la retention (2 versions validees)'
root_entries="$(rclone lsf "$ROOT" --dirs-only --max-depth 1 --retries 5)" || exit 1
completed=()
while IFS= read -r entry; do
  folder="${entry%/}"
  [[ "$folder" != '.incoming' && -n "$folder" ]] || continue
  if [[ ! "$folder" =~ ^20[0-9]{2}-[01][0-9]-[0-3][0-9]_[0-2][0-9][0-5][0-9][0-5][0-9]Z$ ]]; then
    echo "IGNORER dossier inattendu : $folder"; continue
  fi
  if [[ "$folder" == "$SEED" ]]; then
    # L'archive initiale a ete relue et comparee depuis le PC le 24/11.
    # Une copie distincte des sources est exigee avant sa suppression.
    seed_files="$(rclone lsf "$ROOT/$SEED" --files-only --max-depth 1 --retries 5)" || exit 1
    if grep -Fxq "LMV_R315_CHIFFRE_${SEED}.zip" <<< "$seed_files" && \
       grep -Fxq 'SHA256_ARCHIVES.txt' <<< "$seed_files" && \
       grep -Fxq "$SOURCE_ZIP" <<< "$seed_files"; then
      completed+=("$folder")
    else
      echo "PROTEGER : seed incomplet / inattendu $folder"
    fi
  else
    success="$(rclone cat "$ROOT/$folder/_SUCCESS" --retries 3 2>/dev/null)" || {
      echo "PROTEGER : sans marqueur lisible $folder"; continue;
    }
    if grep -Fxq 'format=R315_AGE_V1' <<< "$success" && \
       grep -Fxq "backup_id=$folder" <<< "$success" && \
       grep -Eq '^sha256_manifest=[a-f0-9]{64}$' <<< "$success"; then
      completed+=("$folder")
    else
      echo "PROTEGER : marqueur non valide $folder"
    fi
  fi
done <<< "$root_entries"

if (( ${#completed[@]} < 3 )); then
  echo "RETENTION : ${#completed[@]} version(s) reconnue(s), aucune suppression."
  exit 0
fi

mapfile -t ordered < <(printf '%s\n' "${completed[@]}" | LC_ALL=C sort -r)
if (( ${#ordered[@]} != 3 )); then
  echo "SECURITE : ${#ordered[@]} versions reconnues ; suppression automatique bloquee (attendu 3)." >&2
  exit 1
fi
[[ "${ordered[0]}" == "$ID" ]] || { echo 'SECURITE : nouvelle sauvegarde pas la plus recente.' >&2; exit 1; }
old="${ordered[2]}"

# Toujours verifier integralement les deux copies a conserver, y compris les
# empreintes SHA256 de leurs archives retelechargees, avant de supprimer l'ancienne.
verify_new() {
  local candidate="$1" folder="$verify_base/$candidate" success manifest_hash
  mkdir -p "$folder"
  rclone copy "$ROOT/$candidate" "$folder" --transfers 1 --checkers 2 --retries 5
  for file in 01_Supabase.tar.gz.age 02_Stripe.tar.gz.age SHA256_ENCRYPTED.txt INFO.txt _SUCCESS; do
    [[ -s "$folder/$file" ]] || return 1
  done
  grep -Fxq "backup_id=$candidate" "$folder/INFO.txt" || return 1
  grep -Fxq "backup_id=$candidate" "$folder/_SUCCESS" || return 1
  (cd "$folder" && sha256sum --check SHA256_ENCRYPTED.txt --status) || return 1
  manifest_hash="$(sha256sum "$folder/SHA256_ENCRYPTED.txt" | awk '{print $1}')"
  grep -Fxq "sha256_manifest=$manifest_hash" "$folder/_SUCCESS" || return 1
  echo "RELUE ET VERIFIEE : $candidate"
}

verify_seed() {
  local folder="$verify_base/$SEED"
  mkdir -p "$folder"
  rclone copy "$ROOT/$SEED" "$folder" --transfers 1 --checkers 2 --retries 5
  [[ -s "$folder/SHA256_ARCHIVES.txt" ]] || return 1
  (cd "$folder" && sha256sum --check SHA256_ARCHIVES.txt --status) || return 1
  unzip -tq "$folder/LMV_R315_CHIFFRE_${SEED}.zip" >/dev/null || return 1
  echo "SEED RELUE ET VERIFIEE : $SEED"
}

for candidate in "${ordered[0]}" "${ordered[1]}"; do
  if [[ "$candidate" == "$SEED" ]]; then verify_seed; else verify_new "$candidate"; fi || {
    echo "SECURITE : verification echouee pour $candidate ; ancienne version conservee." >&2
    exit 1
  }
done

# La premiere version du 24/11 est la seule qui porte les sources b012855.
# On interdit sa suppression avant confirmation de sa copie independante.
if [[ "$old" == "$SEED" ]]; then
  echo 'Verification du ZIP sources b012855 archive independamment...'
  rclone copyto "$SOURCE_REMOTE" "$verify_base/source-preservee.zip" --retries 5 || {
    echo 'SECURITE : sources non archivees separement ; seed conserve.' >&2; exit 1;
  }
  saved_sha="$(sha256sum "$verify_base/source-preservee.zip" | awk '{print $1}')"
  [[ "$saved_sha" == "$SOURCE_EXPECTED_SHA" ]] || {
    echo 'SECURITE : SHA256 de la copie independante des sources incorrect ; seed conserve.' >&2; exit 1;
  }
fi

# 4 : une seule ancienne version expressement eligible, jamais de purge massive.
echo "4/4 : 2 dernieres versions verifiees ; suppression de la seule version plus ancienne : $old"
rclone purge "$ROOT/$old" --retries 5

echo 'R31.5 : rotation OK, exactement 2 versions recentes conservees.'
rclone about 'LMVPCLOUD:' || true
