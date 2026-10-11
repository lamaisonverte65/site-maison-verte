import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('documentation explique secrets, baseline, pCloud EU et limites de restauration', () => {
  const src = readRequired('docs/operations/BACKUP_SUPABASE_PCLOUD.md');
  for (const term of ['SUPABASE_DB_URL', 'SUPABASE_URL', 'PCLOUD_TOKEN', 'baseline', 'eapi.pcloud.com', 'manifest.json']) {
    assert.match(src, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(src, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(src, /Auth|auth/);
  assert.match(src, /Storage|storage/);
  assert.match(src, /Vault|vault/);
});
