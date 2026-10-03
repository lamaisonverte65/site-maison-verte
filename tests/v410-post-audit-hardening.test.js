import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  return readFileSync(path, "utf8");
}

test("refuse and manual confirm persist the business state before sending the decision email", () => {
  const admin = source("src/pages/Admin.jsx");

  const refuse = admin.slice(admin.indexOf('if (modal.type === "refuse")'), admin.indexOf('if (modal.type === "confirm")'));
  assert.ok(refuse.indexOf('.update({') < refuse.indexOf('sendDecisionEmail('));

  const confirm = admin.slice(admin.indexOf('if (modal.type === "confirm")'), admin.indexOf('if (modal.type === "cancel")'));
  assert.ok(confirm.indexOf('.update({') < confirm.indexOf('sendDecisionEmail('));
});

test("manual payment has one server-side writer and persists the Stripe session before emailing it", () => {
  const admin = source("src/pages/Admin.jsx");
  const service = source("src/services/bookingActionsService.js");
  const fn = source("netlify/functions/create-manual-payment-session.js");

  const adminBlock = admin.slice(admin.indexOf('if (modal.type === "manual_payment")'), admin.indexOf('setModal(null)'));
  assert.doesNotMatch(adminBlock, /supabase\.from\("booking_requests"\)\.update/);

  const serviceBlock = service.slice(service.indexOf("export async function createManualPayment"), service.indexOf("export async function refundBookingPayment"));
  assert.doesNotMatch(serviceBlock, /guestEmail|guestFirstName|guestLastName|startDate|endDate/);

  assert.ok(fn.indexOf('manual_payment_stripe_session_id: session.id') < fn.indexOf('await sendManualPaymentEmail({'));
});

test("balance payment persists its Stripe session id and RPC validates the exact current session", () => {
  const payBalance = source("netlify/functions/pay-balance.js");
  const migration = source("supabase/migrations/202610030001_v410_payment_flow_hardening.sql");

  assert.match(payBalance, /balance_payment_stripe_session_id:\s*session\.id/);
  assert.ok(payBalance.indexOf('balance_payment_stripe_session_id: session.id') < payBalance.indexOf('statusCode: 303'));

  assert.match(migration, /add column if not exists balance_payment_stripe_session_id text/i);
  assert.match(migration, /v_booking\.balance_payment_stripe_session_id\s+is distinct from\s+p_checkout_session_id/i);
});

test("manual balance request persists its durable state before sending the email", () => {
  const fn = source("netlify/functions/create-balance-checkout-session.js");
  assert.ok(fn.indexOf('.from("booking_requests").update(updatePayload)') < fn.indexOf('await sendBalanceEmail('));
});


test("automatic balance reminders persist their durable marker before sending email", () => {
  const fn = source("netlify/functions/check-balance-payments.js");
  const block = fn.slice(fn.indexOf("const paymentLink = createBalancePaymentUrl"), fn.indexOf("await logBookingEvent({", fn.indexOf("const paymentLink = createBalancePaymentUrl")));
  assert.ok(block.indexOf('.from("booking_requests")') < block.indexOf("await sendEmail("));
});

test("Lot 4 restores tourist tax collection and rejects V4.10 manual overpayment in Stripe RPC", () => {
  const migration = source("supabase/migrations/202610030002_v410_post_audit_financial_hardening.sql");
  assert.match(migration, /v_total_paid_ledger numeric := 0/i);
  assert.match(migration, /tourist_tax_collected = greatest/i);
  assert.match(migration, /v_total_paid_ledger - greatest/i);
  assert.match(migration, /manual_exceeds_remaining_due/i);
  assert.match(migration, /p_amount > v_remaining_due \+ 0\.01/i);
  assert.match(migration, /balance_payment_stripe_session_id\s+is distinct from\s+p_checkout_session_id/i);
});

test("obsolete Checkout sessions are expired before replacement and on booking termination", () => {
  const manual = source("netlify/functions/create-manual-payment-session.js");
  const balance = source("netlify/functions/pay-balance.js");
  const expired = source("netlify/functions/check-expired-bookings.js");
  const deleted = source("netlify/functions/delete-booking-request.js");
  const refund = source("netlify/functions/refund-booking-payment.js");

  assert.match(manual, /toCents\(numericAmount\) > toCents\(remainingDue\)/);
  assert.ok(manual.indexOf("toCents(numericAmount) > toCents(remainingDue)") < manual.indexOf("stripe.checkout.sessions.create("));
  assert.ok(manual.indexOf("expireOpenCheckoutSession(") < manual.indexOf("stripe.checkout.sessions.create("));
  assert.ok(balance.indexOf("expireOpenCheckoutSession(") < balance.indexOf("stripe.checkout.sessions.create("));
  assert.match(expired, /expireBookingOpenCheckoutSessions\(stripe, booking\)/);
  assert.ok(expired.indexOf("expireBookingOpenCheckoutSessions(stripe, booking)") < expired.indexOf(".update({"));
  assert.match(expired, /\.eq\("status", "accepted"\)/);
  assert.match(deleted, /expireBookingOpenCheckoutSessions\(stripe, existing\)/);
  assert.match(refund, /result\?\.booking\?\.status === "cancelled"/);
  assert.match(refund, /expireBookingOpenCheckoutSessions\(stripe, result\.booking\)/);
});
