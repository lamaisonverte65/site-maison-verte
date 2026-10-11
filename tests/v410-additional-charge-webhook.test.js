import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lib = fs.readFileSync('netlify/functions/_lib/stripe-checkout-completed.js','utf8');
const webhook = fs.readFileSync('netlify/functions/stripe-webhook.js','utf8');
const sql = fs.readFileSync('supabase/migrations/202610100002_v410_additional_charge_payment.sql','utf8');

test('checkout completion routes additional charge through dedicated atomic payment path', () => {
  assert.match(lib, /manualReason === "additional_charge"/);
  assert.match(lib, /additional_charge_id/);
  assert.match(lib, /applyAdditionalChargePayment/);
  assert.match(webhook, /apply_additional_charge_payment/);
});

test('additional charge payment stays outside contract aggregates and is idempotent', () => {
  assert.match(sql, /apply_additional_charge_payment/i);
  assert.match(sql, /booking_request_id[\s\S]*null/i);
  assert.match(sql, /on conflict \(stripe_checkout_session_id\) do nothing/i);
  assert.match(sql, /status = 'paid'/i);
  assert.doesNotMatch(sql, /recompute_booking_financial_aggregates/i);
});
