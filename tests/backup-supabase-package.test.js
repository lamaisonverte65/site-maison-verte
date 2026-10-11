import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('assemblage construit un paquet complet avant de générer checksums et manifest', () => {
  const src = readRequired('scripts/backup/assemble-backup.sh');
  for (const required of [
    'supabase-inventory.sh',
    'backup-database.sh',
    'export-public-tables.sh',
    'backup-storage.mjs',
    'supabase/migrations',
    'build-manifest.mjs',
    'SHA256SUMS',
  ]) assert.match(src, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(src, /roles\.sql/);
  assert.match(src, /schema\.sql/);
  assert.match(src, /data\.sql/);
  assert.match(src, /auth-data\.sql/);
  assert.match(src, /bash \"\$SCRIPT_DIR\/supabase-inventory\.sh\"/);
  assert.match(src, /bash \"\$SCRIPT_DIR\/backup-database\.sh\"/);
  assert.match(src, /test -s|\[ -s/);
});

test('assemblage tolère l’absence totale de l’historique supabase_migrations mais valide une paire présente', () => {
  const src = readRequired('scripts/backup/assemble-backup.sh');
  assert.match(src, /MIGRATION_HISTORY_SCHEMA=.*migration-history-schema\.sql/);
  assert.match(src, /MIGRATION_HISTORY_DATA=.*migration-history-data\.sql/);
  assert.match(src, /if \[\[ -e \"\$MIGRATION_HISTORY_SCHEMA\" \|\| -e \"\$MIGRATION_HISTORY_DATA\" \]\]/);
  assert.match(src, /test -s \"\$MIGRATION_HISTORY_SCHEMA\"/);
  assert.match(src, /test -s \"\$MIGRATION_HISTORY_DATA\"/);
});
