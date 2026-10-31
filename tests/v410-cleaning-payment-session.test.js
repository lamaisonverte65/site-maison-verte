import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('netlify/functions/create-cleaning-payment-session.js', 'utf8');

test('cleaning payment session is owner-only and derives amount from cleaning issue', () => {
  assert.match(source, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.match(source, /booking_cleaning_issues/);
  assert.match(source, /amount_due/);
  assert.doesNotMatch(source, /body\.amount|data\.amount|numericAmount/);
  assert.match(source, /manual_reason:\s*"cleaning"/);
  assert.match(source, /cleaning_issue_id/);
});

test('cleaning payment session does not write manual payment fields on booking_requests', () => {
  assert.doesNotMatch(source, /manual_payment_amount|manual_payment_link|manual_payment_reason|manual_payment_status|manual_payment_stripe_session_id/);
  const checkout = fs.readFileSync('netlify/functions/_lib/special-payment-checkout.js', 'utf8');
  assert.match(checkout, /status:\s*"payment_requested"/);
  assert.match(source, /openSpecialPaymentCheckout/);
});
