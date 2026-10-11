import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/202610090004_v410_post_stay_cleaning_billing.sql', 'utf8');

test('cleaning billing migration adds technical references without changing booking contract totals', () => {
  assert.match(sql, /confirmed_at timestamptz/i);
  assert.match(sql, /cancelled_at timestamptz/i);
  assert.match(sql, /stripe_session_id text/i);
  assert.match(sql, /payment_id uuid references public\.payments\(id\)/i);
  assert.match(sql, /invoice_id uuid references public\.customer_invoices\(id\)/i);
  assert.doesNotMatch(sql, /update\s+public\.booking_requests\s+set\s+contract_total/i);
});

test('invoice migration distinguishes stay and post stay cleaning invoices', () => {
  assert.match(sql, /invoice_kind text not null default 'stay'/i);
  assert.match(sql, /post_stay_cleaning/i);
  assert.match(sql, /drop index if exists public\.customer_invoices_direct_booking_unique_idx/i);
  assert.match(sql, /where source = 'direct' and booking_request_id is not null and invoice_kind = 'stay'/i);
  assert.match(sql, /create unique index customer_invoices_cleaning_issue_unique_idx[\s\S]*\(cleaning_issue_id\)/i);
});
