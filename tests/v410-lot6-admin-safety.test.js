import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

  assert.match(fn, /PAYABLE_MANUAL_STATUSES\s*=\s*new Set\(\["accepted",\s*"deposit_paid",\s*"paid"\]\)/);
  const guard = fn.indexOf("PAYABLE_MANUAL_STATUSES.has");
  const create = fn.indexOf("stripe.checkout.sessions.create(");
  assert.ok(guard >= 0 && create > guard, "status guard must run before Stripe Checkout creation");
  assert.match(fn, /n’est pas dans un état permettant de demander un paiement|n'est pas dans un état permettant de demander un paiement/);
});
