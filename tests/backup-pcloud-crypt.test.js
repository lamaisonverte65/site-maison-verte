import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('upload pCloud passe exclusivement par un remote rclone crypt avec noms chiffrés', () => {
  const src = readRequired('scripts/backup/upload-pcloud.sh');
  assert.match(src, /RCLONE_CRYPT_PASSWORD/);
  assert.match(src, /RCLONE_CRYPT_PASSWORD2/);
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_TYPE=crypt/);
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_REMOTE=/);
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_PASSWORD=/);
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_PASSWORD2=/);
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_FILENAME_ENCRYPTION=standard/);
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_DIRECTORY_NAME_ENCRYPTION=true/);
  assert.match(src, /LMVCRYPT:/);
  assert.match(src, /rclone cryptcheck/);
  assert.doesNotMatch(src, /^REMOTE="LMVPCLOUD:/m);
  assert.doesNotMatch(src, /^STAGING="LMVPCLOUD:/m);
});

test('rotation agit sur la vue chiffrée et jamais directement sur le remote pCloud brut', () => {
  const src = readRequired('scripts/backup/rotate-pcloud.sh');
  assert.match(src, /RCLONE_CONFIG_LMVCRYPT_TYPE=crypt/);
  assert.match(src, /LMVCRYPT:/);
  assert.doesNotMatch(src, /^\s*local remote="LMVPCLOUD:/im);
});

test('workflow exige les deux secrets crypt sans exposer leur valeur', () => {
  const src = readRequired('.github/workflows/backup-supabase.yml');
  assert.match(src, /secrets\.RCLONE_CRYPT_PASSWORD/);
  assert.match(src, /secrets\.RCLONE_CRYPT_PASSWORD2/);
  assert.match(src, /RCLONE_CRYPT_PASSWORD missing/);
  assert.match(src, /RCLONE_CRYPT_PASSWORD2 missing/);
});

test('documentation impose des valeurs rclone obscure et explique la clé de récupération', () => {
  const src = readRequired('docs/operations/BACKUP_SUPABASE_PCLOUD.md');
  assert.match(src, /rclone obscure/i);
  assert.match(src, /RCLONE_CRYPT_PASSWORD/);
  assert.match(src, /RCLONE_CRYPT_PASSWORD2/);
  assert.match(src, /ne jamais.*perdre|perdre.*impossible.*déchiffr/i);
});
