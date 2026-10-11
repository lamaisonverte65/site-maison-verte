import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/202610100001_v410_additional_charges.sql','utf8');

test('schema stores generic additional charges independently from booking contract totals', () => {
  assert.match(sql, /create table if not exists public\.booking_additional_charges/i);
  assert.match(sql, /booking_request_id uuid not null/i);
  assert.match(sql, /cleaning_issue_id uuid/i);
  assert.match(sql, /reason_label text not null/i);
  assert.match(sql, /amount numeric/i);
  assert.match(sql, /customer_message text/i);
  assert.match(sql, /status text not null default 'draft'/i);
  assert.doesNotMatch(sql, /unique\s*\(\s*booking_request_id\s*\)/i);
});

test('schema extends invoices with additional_charge identity without weakening stay uniqueness', () => {
  assert.match(sql, /additional_charge_id uuid/i);
  assert.match(sql, /invoice_kind in \('stay', 'post_stay_cleaning', 'additional_charge'\)/i);
  assert.match(sql, /customer_invoices_additional_charge_unique_idx/i);
});
