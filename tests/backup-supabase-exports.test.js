import test from 'node:test';
import assert from 'node:assert/strict';
import { readRequired } from './backup-test-helpers.js';

test('exports CSV parcourent l’inventaire réel des tables public', () => {
  const src = readRequired('scripts/backup/export-public-tables.sh');
  assert.match(src, /public_tables\.tsv/);
  assert.match(src, /while .*read/);
  assert.match(src, /COPY .*TO STDOUT|\\copy/i);
  assert.match(src, /HEADER/);
  assert.match(src, /count\(\*\)/i);
  assert.match(src, /public_table_counts\.tsv/);
  assert.doesNotMatch(src, /booking_requests.*payments.*customer_invoices/s);
});
