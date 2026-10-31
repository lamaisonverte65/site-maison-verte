import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const endpoint = fs.readFileSync('netlify/functions/create-additional-charge-session.js','utf8');
const email = fs.readFileSync('netlify/functions/_lib/additional-charge-email.js','utf8');

test('Stripe session uses stored additional charge amount and generic metadata', () => {
  assert.match(endpoint, /booking_additional_charges/);
  assert.match(endpoint, /manual_reason:\s*"additional_charge"/);
  assert.match(endpoint, /additional_charge_id/);
  assert.match(endpoint, /unit_amount:\s*Math\.round\(Number\(charge\.amount\) \* 100\)/);
  assert.doesNotMatch(endpoint, /body\.amount|data\.amount/);
});

test('additional charge email contains free reason, amount, owner message and payment button', () => {
  assert.match(email, /reason_label/);
  assert.match(email, /customer_message/);
  assert.match(email, /paymentLink/);
  assert.match(email, /Régler/);
});

test('server rejects a missing client email before creating any Stripe session', () => {
  const missingEmailCheck = endpoint.indexOf('Aucune adresse email client n’est renseignée pour cette réservation.');
  const sharedCheckout = endpoint.indexOf('openSpecialPaymentCheckout({');
  const helper = fs.readFileSync('netlify/functions/_lib/special-payment-checkout.js','utf8');
  assert.ok(missingEmailCheck >= 0, 'missing-email guard must exist');
  assert.ok(sharedCheckout > missingEmailCheck, 'missing-email guard must run before shared Stripe Checkout creation');
  assert.match(helper, /stripe\.checkout\.sessions\.create/);
});
