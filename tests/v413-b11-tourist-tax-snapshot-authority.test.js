import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildTouristTaxDeclarationRows, summarizeTouristTaxDeclaration } from "../netlify/functions/_lib/tourist-tax-declaration.js";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const historicalBooking = {
  id: "historical-1",
  start_date: "2026-09-10",
  end_date: "2026-09-11",
  guest_first_name: "Historique",
  guest_last_name: "Client",
  tourist_tax_collector: "la_maison_verte",
  tourist_tax_collected: 2.30,
  tourist_tax_refunded: 0,
  tourist_tax_snapshot: {
    classification: "3_star",
    occupants: 2,
    taxablePeople: 1,
    exemptPeople: 1,
    nights: [
      { date: "2026-09-10", accommodationCents: 10000, totalTaxCents: 230, rule: { id: "snapshot-rule", classification: "3_star" } },
    ],
  },
};

test("B1.1 historical tourist tax uses the stored snapshot without a current rule catalog", () => {
  const rows = buildTouristTaxDeclarationRows({ bookings: [historicalBooking] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].snapshotTaxCents, 230);
  assert.equal(rows[0].commercialRuleId, "snapshot-rule");
  assert.equal(rows[0].status, "ok");

  const summary = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 9 });
  assert.equal(summary.totals.snapshotTaxCents, 230);
  assert.equal(summary.totals.netCollectedCents, 230);
});

test("B1.1 a retrodated current rule cannot replace the historical snapshot", () => {
  const retrodatedRule = {
    id: "created-later",
    effective_from: "2026-01-01",
    effective_to: null,
    classification: "3_star",
    calculation_type: "fixed",
    fixed_rate_cents: 360,
    is_active: true,
  };
  const rows = buildTouristTaxDeclarationRows({
    bookings: [historicalBooking],
    classificationHistory: [{ classification: "3_star", effective_from: "2026-01-01", effective_to: null }],
    rules: [retrodatedRule],
  });
  assert.equal(rows[0].snapshotTaxCents, 230);
  assert.notEqual(rows[0].snapshotTaxCents, 360);
});

test("B1.1 register keeps historical snapshots and reads rules only for a separate declaration amount", () => {
  const endpoint = read("netlify/functions/admin-tourist-tax-declaration.js");
  assert.match(endpoint, /tourist_tax_classification_history/);
  assert.match(endpoint, /tourist_tax_rules/);
  assert.match(endpoint, /classificationHistory/);
  assert.match(endpoint, /rules:/);
  assert.doesNotMatch(endpoint, /\.insert\(/);
  assert.doesNotMatch(endpoint, /\.update\(/);
  assert.doesNotMatch(endpoint, /\.delete\(/);
  assert.doesNotMatch(endpoint, /\.rpc\(/);
});
