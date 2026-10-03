import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(path, "utf8");
}

test("Lot 5 resets the automatic balance marker when the client email fails", () => {
  const fn = source("netlify/functions/check-balance-payments.js");
  assert.match(fn, /catch\s*\(emailError\)[\s\S]*balanceStepMarker\(step\)[\s\S]*\[marker\]:\s*null/);
});

test("Lot 5 compares V4.10 payment amounts in integer cents", () => {
  const manual = source("netlify/functions/create-manual-payment-session.js");
  const migration = source("supabase/migrations/202610030003_v410_lot5_payment_resilience.sql");

  assert.match(manual, /toCents\(numericAmount\)\s*>\s*toCents\(remainingDue\)/);
  assert.doesNotMatch(manual, /remainingDue \+ 0\.01/);
  assert.match(migration, /round\(p_amount \* 100\)/i);
  assert.match(migration, /round\(v_remaining_due \* 100\)/i);
  assert.doesNotMatch(migration, />\s*0\.01/i);
  assert.doesNotMatch(migration, /\+\s*0\.01/i);
});

test("Lot 5 notifies the owner after an applied deposit balance or full payment", () => {
  const webhook = source("netlify/functions/stripe-webhook.js");
  assert.match(webhook, /async function sendOwnerPaymentStatusEmail/);
  assert.match(webhook, /paymentType === "deposit"/);
  assert.match(webhook, /paymentType === "balance"/);
  assert.match(webhook, /paymentType === "full"/);
  assert.match(webhook, /clientEmailResult/);
  assert.match(webhook, /<strong>Email client :<\/strong>/);
  assert.match(webhook, /ÉCHEC/);
  assert.ok(webhook.indexOf("await sendPaymentConfirmationEmail(") < webhook.indexOf("await sendOwnerPaymentStatusEmail("));
});

test("Lot 5 tells the owner when an accepted request expires without initial payment", () => {
  const expired = source("netlify/functions/check-expired-bookings.js");
  assert.match(expired, /async function sendOwnerPaymentNotReceivedAlert/);
  assert.match(expired, /Acompte non reçu|Paiement intégral non reçu/);
  assert.match(expired, /await sendOwnerPaymentNotReceivedAlert\(booking, emailResult\)/);
});

test("Stripe expiration remains retry-safe when a Checkout Session is already non-open", () => {
  const helper = source("netlify/functions/_lib/stripe-checkout-session.js");
  assert.match(helper, /if \(session\?\.status !== "open"\) return false/);
  assert.match(helper, /if \(error\?\.code === "resource_missing"\) return false/);
});
