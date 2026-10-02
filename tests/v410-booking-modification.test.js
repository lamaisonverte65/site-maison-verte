import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const update = fs.readFileSync("netlify/functions/update-booking-request.js", "utf8");
const quote = fs.readFileSync("netlify/functions/_lib/booking-quote.js", "utf8");
const panel = fs.readFileSync("src/components/admin/ReservationPanel.jsx", "utf8");
const calendarPanel = fs.readFileSync("src/components/admin/calendar/SelectionPanel.jsx", "utf8");

function v410Block() {
  const start = update.indexOf('if (bookingKind === "site" && isV410 && financialInputsChanged)');
  const end = update.indexOf('} else if (bookingKind === "site" && !isV410)', start);
  assert.ok(start >= 0 && end > start);
  return update.slice(start, end);
}

function v410QuoteHelper() {
  const start = update.indexOf('async function calculateV410ModificationQuote');
  const end = update.indexOf('async function findOrCreateCustomer', start);
  assert.ok(start >= 0 && end > start);
  return update.slice(start, end);
}

test("B3.2 identifies V4.10 from the contractual financial snapshot", () => {
  assert.match(update, /hasV410FinancialSnapshot\(existingBooking\)/);
});

test("administrative-only edits do not recalculate V4.10 money", () => {
  assert.match(update, /financialInputsChanged[\s\S]*startDate[\s\S]*endDate[\s\S]*adults[\s\S]*children/);
  assert.match(update, /isV410 && financialInputsChanged/);
});

test("V4.10 contractual edits use the central quote engine", () => {
  assert.match(v410QuoteHelper(), /calculatePublicBookingQuote\(supabase/);
  assert.match(v410Block(), /quoteToBookingMoney\(quote\)/);
});

test("V4.10 modification preserves snapshotted deposit rate and tourist-tax classification", () => {
  const block = v410QuoteHelper();
  assert.match(block, /depositRate:\s*Number\(existingBooking\.deposit_rate\)/);
  assert.match(block, /touristTaxClassification:\s*taxSnapshot\.classification/);
  assert.match(quote, /context\.depositRate/);
  assert.match(quote, /context\.touristTaxClassification/);
});

test("V4.10 modification preserves historical cleaning tariff and promotion rate", () => {
  const block = v410QuoteHelper();
  assert.match(block, /cleaningFeeCents:\s*Math\.round\(Number\(existingBooking\.cleaning_fee/);
  assert.match(block, /promotion_discount_rate/);
  assert.match(quote, /financialContext\.promotion/);
});

test("legacy total remains a fallback only and cannot overwrite V4.10 snapshots", () => {
  const legacyStart = update.indexOf('} else if (bookingKind === "site" && !isV410)');
  assert.ok(legacyStart >= 0);
  const beforeLegacy = update.slice(0, legacyStart);
  assert.doesNotMatch(beforeLegacy, /estimated_total:\s*legacyTotal|owner_price:\s*legacyTotal|gross_amount:\s*legacyTotal/);
  const legacy = update.slice(legacyStart, update.indexOf('if (bookingKind !== "site")', legacyStart));
  assert.match(legacy, /estimated_total = legacyTotal/);
  assert.match(legacy, /owner_price = legacyTotal/);
});

test("financial adjustment is explicit and never triggers automatic payment or refund", () => {
  assert.match(update, /remainingDue:\s*Math\.max/);
  assert.match(update, /overpayment:\s*Math\.max/);
  assert.match(update, /automaticPayment:\s*false/);
  assert.match(update, /automaticRefund:\s*false/);
});

test("admin UI no longer exposes editable total for V4.10 reservations", () => {
  assert.match(panel, /isV410[\s\S]*Total contractuel/);
  assert.match(calendarPanel, /isV410Edit[\s\S]*Total contractuel actuel/);
});

test("B4.3.2A-3 preview uses the same central quote helper and returns before customer or booking writes", () => {
  assert.match(update, /body\.preview === true/);
  assert.match(update, /calculateV410ModificationQuote\(existingBooking/);
  const previewStart = update.indexOf('if (body.preview === true)');
  const customerWrite = update.indexOf('const customer = await findOrCreateCustomer', previewStart);
  const previewReturn = update.indexOf('preview: true', previewStart);
  assert.ok(previewStart >= 0 && previewReturn > previewStart && customerWrite > previewReturn);
});

test("B4.3.2A-3 preview exposes before/after tax and explicit tax refund without automatic refund", () => {
  assert.match(update, /touristTaxRefund:\s*Math\.max\(beforeTax - afterTax, 0\)/);
  assert.match(panel, /Conséquences financières — Avant \/ Après/);
  assert.match(panel, /Dont taxe de séjour à rembourser/);
  assert.match(panel, /Aucun paiement ni remboursement n’est déclenché automatiquement/);
});

test("B4.3.2A-3 requires preview before confirming a V4.10 edit", () => {
  assert.match(panel, /Calculer les modifications/);
  assert.match(panel, /Confirmer les modifications/);
  assert.match(panel, /Modifier la réservation/);
});
