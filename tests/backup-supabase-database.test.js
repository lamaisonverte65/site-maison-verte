import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('backup SQL utilise les dumps Supabase restaurables et conserve Auth + historique migrations si disponible', () => {
  const src = readRequired('scripts/backup/backup-database.sh');
  assert.match(src, /supabase db dump/);
  assert.match(src, /--role-only/);
  assert.match(src, /schema\.sql/);
  assert.match(src, /data\.sql/);
  assert.match(src, /--data-only/);
  assert.match(src, /--use-copy/);
  assert.match(src, /to_regnamespace\(['"]supabase_migrations['"]\)/);
  assert.match(src, /HAS_MIGRATION_SCHEMA/);
  assert.match(src, /migration-history-schema\.sql/);
  assert.match(src, /migration-history-data\.sql/);
  assert.match(src, /supabase_migrations absent|Schema supabase_migrations absent/i);
  assert.doesNotMatch(src, /echo\s+.*SUPABASE_DB_URL/);
});
