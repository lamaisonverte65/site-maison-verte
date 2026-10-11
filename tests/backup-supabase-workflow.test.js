import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('workflow GitHub exécute backups planifiés et manuels avec permissions minimales', () => {
  const src = readRequired('.github/workflows/backup-supabase.yml');
  assert.match(src, /schedule:/);
  assert.match(src, /workflow_dispatch:/);
  assert.match(src, /backup_kind:/);
  assert.match(src, /contents:\s*read/);
  assert.doesNotMatch(src, /contents:\s*write/);
  for (const secret of ['SUPABASE_DB_URL', 'SUPABASE_URL', 'PCLOUD_TOKEN']) assert.match(src, new RegExp(`secrets\\.${secret}`));
  assert.match(src, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(src, /supabase\/setup-cli@/);
  assert.match(src, /assemble-backup\.sh/);
  assert.match(src, /upload-pcloud\.sh/);
  assert.match(src, /rotate-pcloud\.sh/);
  assert.match(src, /monthly/);
  assert.match(src, /yearly/);
  assert.match(src, /actions\/upload-artifact@/);
});
