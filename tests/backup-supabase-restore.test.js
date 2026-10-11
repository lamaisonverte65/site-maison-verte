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
  assert.match(src, /session_replication_role = replica/);
  assert.match(src, /ALLOW_PRODUCTION_RESTORE|CONFIRM_TEST_RESTORE/);
});

test('restauration tolère un backup sans historique supabase_migrations', () => {
  const src = readRequired('scripts/backup/verify-restore.sh');
  assert.match(src, /-f database\/migration-history-schema\.sql/);
  assert.match(src, /-f database\/migration-history-data\.sql/);
  assert.match(src, /restore continues without supabase_migrations history/i);
});

test('documentation de restauration couvre Storage, réglages Supabase et contraintes circulaires', () => {
  const src = readRequired('docs/operations/RESTORE_SUPABASE_BACKUP.md');
  assert.match(src, /Storage/i);
  assert.match(src, /Auth/i);
  assert.match(src, /Realtime/i);
  assert.match(src, /extension/i);
  assert.match(src, /production/i);
  assert.match(src, /foreign-key|clé.*étrangère|FK circulaire/i);
  assert.match(src, /supabase_migrations.*optionnel|optionnel.*supabase_migrations/i);
});
