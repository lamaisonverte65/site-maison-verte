import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildTouristTaxDeclarationRows, summarizeTouristTaxDeclaration } from "../netlify/functions/_lib/tourist-tax-declaration.js";

const rules = [
  { id: "unclassified-2026", classification: "unclassified", effective_from: "2026-01-01", effective_to: "2026-12-31", calculation_type: "proportional", base_rate_basis_points: 500, department_additional_basis_points: 1000, regional_additional_basis_points: 3400, base_cap_cents: 460, is_active: true },
  { id: "three-star-2026", classification: "3_star", effective_from: "2026-01-01", effective_to: null, calculation_type: "fixed", fixed_rate_cents: 230, is_active: true },
];
const classificationHistory = [
  { classification: "unclassified", effective_from: "2024-02-15", effective_to: "2026-10-07" },
  { classification: "3_star", effective_from: "2026-10-08", effective_to: null },
];
const booking = {
  id: "nathalie", status: "accepted", guest_first_name: "Nathalie", guest_last_name: "Roussille",
  start_date: "2026-10-15", end_date: "2026-10-18", tourist_tax_collector: "la_maison_verte",
  tourist_tax_amount: 8.28, tourist_tax_collected: 8.28, tourist_tax_refunded: 0,
  tourist_tax_snapshot: { classification: "unclassified", occupants: 4, taxablePeople: 2, exemptPeople: 2,
    nights: [
      { date: "2026-10-15", accommodationCents: 7500, totalTaxCents: 270, rule: { id: "old-1" } },
      { date: "2026-10-16", accommodationCents: 7500, totalTaxCents: 270, rule: { id: "old-1" } },
      { date: "2026-10-17", accommodationCents: 8000, totalTaxCents: 288, rule: { id: "old-1" } },
    ] },
};
const makeRows = (bookings, opts = {}) => buildTouristTaxDeclarationRows({ bookings, classificationHistory, rules, todayDate: "2026-10-20", ...opts });

test("F3.5 Nathalie: preserves 8.28 billed, displays 13.80 due and 5.52 difference", () => {
  const original = structuredClone(booking);
  const rows = makeRows([booking]);
  assert.deepEqual(rows.map((row) => row.snapshotTaxCents), [270, 270, 288]);
  assert.deepEqual(rows.map((row) => row.dueTaxCents), [460, 460, 460]);
  assert.ok(rows.every((row) => row.dueClassification === "3_star"));
  assert.deepEqual(booking, original, "Booking, tax snapshot and cash collection are never modified");
  const summary = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 10 });
  assert.equal(summary.totals.dueTaxCents, 1380);
  assert.equal(summary.totals.billedForDueCents, 828);
  assert.equal(summary.totals.differenceDueBilledCents, 552);
  assert.equal(summary.totals.collectedCents, 828);
});

test("F3.5 stays crossing October 8 use classification by each night", () => {
  const cross = { ...booking, id: "cross", start_date: "2026-10-07", end_date: "2026-10-09",
    tourist_tax_snapshot: { ...booking.tourist_tax_snapshot, nights: [
      { date: "2026-10-07", accommodationCents: 7500, totalTaxCents: 270 },
      { date: "2026-10-08", accommodationCents: 7500, totalTaxCents: 270 },
    ] } };
  const rows = makeRows([cross]);
  assert.deepEqual(rows.map((row) => row.dueClassification), ["unclassified", "3_star"]);
  assert.deepEqual(rows.map((row) => row.dueTaxCents), [270, 460]);
});

test("F3.5 cancelled booking: no nights and no due, even if amounts were retained", () => {
  const cancelled = { ...booking, status: "cancelled", tourist_tax_collected: 8.28, tourist_tax_refunded: 0 };
  const rows = makeRows([cancelled]);
  assert.ok(rows.every((row) => row.dueStatus === "cancelled" && row.dueTaxCents === 0));
  const totals = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 10 }).totals;
  assert.equal(totals.dueTaxCents, 0);
  assert.equal(totals.presumedPerformedNights, 0);
  assert.equal(totals.cancelledNights, 3);
  assert.equal(totals.collectedCents, 828, "reimbursement responsibility remains traceable");
  assert.equal(totals.cancelledTaxStillCollectedCents, 828, "alert for tax collected despite cancellation");
});

test("F3.5 future booking isn't reported as a completed stay", () => {
  const rows = makeRows([booking], { todayDate: "2026-10-01" });
  const totals = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 10 }).totals;
  assert.equal(totals.upcomingNights, 3);
  assert.equal(totals.presumedPerformedNights, 0);
  assert.equal(totals.dueTaxCents, 0);
});

test("F3.5 missing or overlapping regulatory history requires review, never retroactive guessing", () => {
  const rows = makeRows([booking], { classificationHistory: [] });
  const totals = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 10 }).totals;
  assert.equal(totals.needsReviewNights, 3);
  assert.equal(totals.dueTaxCents, 0);
  assert.equal(rows[0].dueTaxCents, null);
});

test("F3.5 payment journal is distinct, owner-protected, append-only with voiding", () => {
  const api = readFileSync(new URL("../netlify/functions/admin-tourist-tax-remittances.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/202610200001_v413_tourist_tax_bank_remittances.sql", import.meta.url), "utf8");
  assert.match(api, /ownerOnly: true/);
  assert.match(api, /voided_at/);
  assert.doesNotMatch(api, /\.delete\(/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.tourist_tax_remittances FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /UPDATE public\.booking_requests/);
  assert.doesNotMatch(migration, /accounting_entries/);
});
