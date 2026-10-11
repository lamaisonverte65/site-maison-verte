import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('inventaire Supabase découvre dynamiquement les objets live sans liste métier codée en dur', () => {
  const src = readRequired('scripts/backup/supabase-inventory.sh');
  assert.match(src, /set -euo pipefail/);
  assert.match(src, /SUPABASE_DB_URL/);
  assert.match(src, /information_schema\.tables|pg_class/);
  assert.match(src, /storage\.buckets/);
  assert.match(src, /storage\.objects/);
  assert.match(src, /auth\.users/);
  assert.match(src, /pg_extension/);
  assert.match(src, /pg_trigger/);
  assert.match(src, /pg_policies/);
  assert.doesNotMatch(src, /booking_requests.*payments.*customer_invoices/s);
});
