import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManualPaymentRequest } from "../netlify/functions/_lib/manual-payment-checkout.js";

function source(path) {
  return readFileSync(path, "utf8");
}

test("Lot 6 removes reservation deletion from the admin reservation UI", () => {
  const panel = source("src/components/admin/ReservationPanel.jsx");
  const admin = source("src/pages/Admin.jsx");

  assert.doesNotMatch(panel, /onDelete\(request\)|>\s*Supprimer\s*</);
  assert.doesNotMatch(admin, /onDelete=\{canManageOpenedReservation \? deleteReservation/);
  assert.doesNotMatch(admin, /async function deleteReservation\(request\)/);
});

test("Lot 6 renders V4.10 booking type and status as read-only in the editor", () => {
  const panel = source("src/components/admin/ReservationPanel.jsx");

  assert.match(panel, /isV410[\s\S]*Statut[\s\S]*lecture seule|isV410[\s\S]*Statut[\s\S]*actions métier/i);
  assert.match(panel, /isV410[\s\S]*Type[\s\S]*verrouill/i);
});

test("Lot 6 backend rejects V4.10 type or status changes outside business workflows", () => {
  const update = source("netlify/functions/update-booking-request.js");

  assert.match(update, /existingBookingKind/);
  assert.match(update, /hasV410FinancialSnapshot\(existingBooking\)/);
  assert.match(update, /requestedBookingKind\s*!==\s*existingBookingKind/);
  assert.match(update, /requestedStatus\s*!==\s*existingStatus/);
  assert.match(update, /type[^\n]*V4\.10|V4\.10[^\n]*type/i);
  assert.match(update, /statut[^\n]*V4\.10|V4\.10[^\n]*statut/i);
});

test("Lot 6 shows manual payment actions only for payable statuses", () => {
  const actions = source("src/components/admin/reservation/FinancialActionsBlock.jsx");
  const panel = source("src/components/admin/ReservationPanel.jsx");

  assert.match(actions, /PAYABLE_STATUSES\s*=\s*new Set\(\["accepted",\s*"deposit_paid",\s*"paid"\]\)/);
  assert.match(actions, /PAYABLE_STATUSES\.has\(status\)/);
  assert.match(panel, /<FinancialActionsBlock[\s\S]*status=\{status\}/);
});

test("Lot 6 backend refuses manual Checkout creation for non-payable booking statuses", () => {
  const fn = source("netlify/functions/create-manual-payment-session.js");
  const helper = source("netlify/functions/_lib/manual-payment-checkout.js");
  assert.match(fn, /openManualPaymentCheckout\(\{/);
  assert.match(helper, /const PAYABLE_STATUSES = new Set\(\["accepted", "deposit_paid", "paid"\]\)/);
  assert.match(helper, /const amountCents = validateManualPaymentRequest\(booking, amount, reason\)/);
  assert.ok(helper.indexOf("validateManualPaymentRequest(booking, amount, reason)") < helper.indexOf("stripe.checkout.sessions.create("));
  for (const current of ["pending", "cancelled", "expired", "refused", "fully_paid", "confirmed"]) {
    assert.throws(() => validateManualPaymentRequest({ status: current, contract_total: 100, deposit_rate: 0.30, deposit_basis: 100, deposit_amount: 30, amount_paid: 0 }, 10, "solde"),
      /n’est pas dans un état permettant de demander un paiement/, current);
  }
  for (const current of ["accepted", "deposit_paid", "paid"]) {
    assert.equal(validateManualPaymentRequest({ status: current, contract_total: 100, deposit_rate: 0.30, deposit_basis: 100, deposit_amount: 30, amount_paid: 0 }, 10, "solde"), 1000);
  }
});
