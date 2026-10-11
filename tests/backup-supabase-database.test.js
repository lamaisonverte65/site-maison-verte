import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('backup SQL utilise les dumps Supabase restaurables et conserve Auth + historique migrations', () => {
  const src = readRequired('scripts/backup/backup-database.sh');
  assert.match(src, /supabase db dump/);
  assert.match(src, /--role-only/);
  assert.match(src, /schema\.sql/);
  assert.match(src, /data\.sql/);
  assert.match(src, /--data-only/);
  assert.match(src, /--use-copy/);
  assert.match(src, /storage\.buckets_vectors/);
  assert.match(src, /storage\.vector_indexes/);
  assert.match(src, /--schema[ =]+auth/);
  assert.match(src, /supabase_migrations/);
  assert.doesNotMatch(src, /echo\s+.*SUPABASE_DB_URL/);
});
