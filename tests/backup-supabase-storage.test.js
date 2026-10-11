import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('backup Storage télécharge chaque objet inventorié avec une clé serveur et protège les chemins', () => {
  const src = readRequired('scripts/backup/backup-storage.mjs');
  assert.match(src, /storage_objects\.json/);
  assert.match(src, /SUPABASE_URL/);
  assert.match(src, /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(src, /\.storage\.from\(/);
  assert.match(src, /\.download\(/);
  assert.match(src, /path\.resolve|resolve\(/);
  assert.match(src, /startsWith/);
  assert.match(src, /metadata.*size|size.*metadata/s);
});
