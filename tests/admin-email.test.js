import test from "node:test";
import assert from "node:assert/strict";
import { buildStoredManualPaymentEmail, validateAdminEmailRequest } from "../netlify/functions/_lib/admin-email.js";

test("the administrative email endpoint accepts only a booking identifier", () => {
  assert.deepEqual(validateAdminEmailRequest({ bookingId: "booking-1" }), { ok: true, bookingId: "booking-1" });
  assert.equal(validateAdminEmailRequest({ bookingId: "booking-1", guestEmail: "victim@example.test" }).ok, false);
  assert.equal(validateAdminEmailRequest({ bookingId: "booking-1", paymentLink: "https://evil.test" }).ok, false);
});

test("manual payment email uses the stored booking recipient and Stripe link", () => {
  const email = buildStoredManualPaymentEmail({
    id: "booking-1",
    guest_email: "guest@example.test",
    guest_first_name: "Alice",
    guest_last_name: "Martin",
    start_date: "2026-10-10",
    end_date: "2026-10-13",
    manual_payment_amount: 120,
    manual_payment_reason: "solde",
    manual_payment_message: "Merci <script>alert(1)</script>",
    manual_payment_link: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
  assert.equal(email.ok, true);
  assert.equal(email.to, "guest@example.test");
  assert.match(email.html, /checkout\.stripe\.com/);
  assert.doesNotMatch(email.html, /<script>/);
});

test("internal owner and housekeeping notes are never inserted into the client payment email", () => {
  const email = buildStoredManualPaymentEmail({
    guest_email: "guest@example.test",
    guest_first_name: "Alice",
    guest_last_name: "Martin",
    start_date: "2026-10-10",
    end_date: "2026-10-13",
    manual_payment_amount: 120,
    manual_payment_reason: "solde",
    manual_payment_message: "Message client autorisé",
    manual_payment_link: "https://checkout.stripe.com/c/pay/cs_test_123",
    housekeeping_notes: "NOTE_OWNER_FOR_HOUSEKEEPING_SECRET",
    housekeeping_user_notes: "NOTE_HOUSEKEEPING_SECRET",
  });
  assert.equal(email.ok, true);
  assert.match(email.html, /Message client autorisé/);
  assert.doesNotMatch(email.html, /NOTE_OWNER_FOR_HOUSEKEEPING_SECRET|NOTE_HOUSEKEEPING_SECRET/);
});

test("non-Stripe stored links are refused", () => {
  const result = buildStoredManualPaymentEmail({
    guest_email: "guest@example.test",
    manual_payment_amount: 120,
    manual_payment_link: "https://evil.test/pay",
  });
  assert.equal(result.ok, false);
});
