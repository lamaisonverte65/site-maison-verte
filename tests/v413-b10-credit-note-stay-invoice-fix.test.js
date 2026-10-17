import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'supabase/migrations/202610170001_v413_credit_note_stay_invoice_fix.sql';
const sql = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';

test('B1.0 credit note trigger targets the issued stay invoice even when other issued invoices exist', () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+public\.create_customer_credit_note_after_refund\s*\(\s*\)/i);
  assert.match(sql, /from\s+public\.customer_invoices\s+ci[\s\S]*ci\.booking_request_id\s*=\s*new\.booking_request_id[\s\S]*ci\.status\s*=\s*'issued'[\s\S]*ci\.invoice_kind\s*=\s*'stay'/i);
  assert.match(sql, /v_invoice_count\s*<>\s*1\s+then\s+return\s+new/i);
  assert.match(sql, /select\s+\*\s+into\s+v_invoice\s+from\s+public\.customer_invoices\s+ci[\s\S]*ci\.invoice_kind\s*=\s*'stay'/i);
  assert.match(sql, /insert\s+into\s+public\.customer_credit_notes/i);
  assert.match(sql, /on\s+conflict\s*\(refund_operation_id\)\s+do\s+nothing/i);
});
