import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

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
