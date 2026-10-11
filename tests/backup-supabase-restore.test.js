import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('restauration vérifie les checksums et restaure dans un ordre sûr', () => {
  const src = readRequired('scripts/backup/verify-restore.sh');
  assert.match(src, /sha256sum -c/);
  assert.match(src, /RESTORE_DB_URL/);
  assert.match(src, /ON_ERROR_STOP/);
  const roles = src.indexOf('roles.sql');
  const schema = src.indexOf('schema.sql');
  const auth = src.indexOf('auth-data.sql');
  const data = src.indexOf('data.sql');
  assert.ok(roles >= 0 && schema > roles && auth > schema && data > auth, 'ordre roles → schema → auth → data attendu');
  assert.match(src, /ALLOW_PRODUCTION_RESTORE|CONFIRM_TEST_RESTORE/);
});

test('documentation de restauration couvre Storage et réglages Supabase non contenus dans le dump', () => {
  const src = readRequired('docs/operations/RESTORE_SUPABASE_BACKUP.md');
  assert.match(src, /Storage/i);
  assert.match(src, /Auth/i);
  assert.match(src, /Realtime/i);
  assert.match(src, /extension/i);
  assert.match(src, /production/i);
});
