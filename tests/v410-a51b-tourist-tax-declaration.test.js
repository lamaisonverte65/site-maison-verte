import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildTouristTaxDeclarationRows, summarizeTouristTaxDeclaration } from "../netlify/functions/_lib/tourist-tax-declaration.js";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const rule = {
  id: "rule-2026",
  effective_from: "2026-01-01",
  effective_to: null,
  classification: "unclassified",
  calculation_type: "proportional",
  base_rate_basis_points: 500,
  department_additional_basis_points: 1000,
  regional_additional_basis_points: 3400,
  base_cap_cents: 460,
  fixed_rate_cents: null,
  is_active: true,
};

const booking = {
  id: "b1",
  start_date: "2026-01-31",
  end_date: "2026-02-02",
  guest_first_name: "Test",
  guest_last_name: "Client",
  tourist_tax_collector: "la_maison_verte",
  tourist_tax_collected: 7.24,
  tourist_tax_refunded: 0,
  tourist_tax_snapshot: {
    classification: "unclassified",
    occupants: 4,
    taxablePeople: 2,
    exemptPeople: 2,
    nights: [
      { date: "2026-01-31", accommodationCents: 10000, totalTaxCents: 362, rule: { id: "commercial" } },
      { date: "2026-02-01", accommodationCents: 10000, totalTaxCents: 362, rule: { id: "commercial" } },
    ],
  },
};

test("A-5.1b recalculates regulatory tax with the shared night engine inputs", () => {
  const rows = buildTouristTaxDeclarationRows({
    bookings: [booking],
    classificationHistory: [{ classification: "unclassified", effective_from: "2024-02-15", effective_to: null }],
    rules: [rule],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].regulatoryTaxCents, 362);
  assert.equal(rows[0].regulatoryDeltaCents, 0);
});

test("A-5.1b splits a cross-month stay by night", () => {
  const rows = buildTouristTaxDeclarationRows({
    bookings: [booking],
    classificationHistory: [{ classification: "unclassified", effective_from: "2024-02-15", effective_to: null }],
    rules: [rule],
  });
  const january = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 1 });
  const february = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 2 });
  assert.equal(january.totals.nights, 1);
  assert.equal(february.totals.nights, 1);
  assert.equal(january.totals.regulatoryTaxCents, 362);
  assert.equal(february.totals.regulatoryTaxCents, 362);
});

test("A-5.1b keeps platform collection outside LMV declaration totals", () => {
  const rows = buildTouristTaxDeclarationRows({
    bookings: [{ ...booking, id: "platform", tourist_tax_collector: "platform" }],
    classificationHistory: [{ classification: "unclassified", effective_from: "2024-02-15", effective_to: null }],
    rules: [rule],
  });
  const january = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 1 });
  assert.equal(january.totals.nights, 0);
  assert.equal(january.totals.platformNights, 1);
  assert.equal(january.totals.regulatoryTaxCents, 0);
});

test("A-5.1b exposes missing historical regulatory data instead of inventing it", () => {
  const rows = buildTouristTaxDeclarationRows({
    bookings: [booking],
    classificationHistory: [{ classification: "unclassified", effective_from: "2024-02-15", effective_to: null }],
    rules: [],
  });
  assert.equal(rows[0].regulatoryTaxCents, null);
  assert.equal(rows[0].status, "missing_regulatory_data");
});

test("A-5.1b endpoint is owner-only and read-only", () => {
  const endpoint = read("netlify/functions/admin-tourist-tax-declaration.js");
  assert.match(endpoint, /ownerOnly: true/);
  assert.match(endpoint, /tourist_tax_classification_history/);
  assert.match(endpoint, /tourist_tax_rules/);
  assert.doesNotMatch(endpoint, /\.insert\(/);
  assert.doesNotMatch(endpoint, /\.update\(/);
  assert.doesNotMatch(endpoint, /\.delete\(/);
  assert.doesNotMatch(endpoint, /\.rpc\(/);
});

test("A-5.1b UI replaces the placeholder with the regulatory registry", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /Taxe de séjour — registre réglementaire/);
  assert.match(panel, /Dû Aure-Louron/);
  assert.match(panel, /Plateformes — contrôle uniquement/);
  assert.match(panel, /Aucune nuitée directe LMV à déclarer pour ce mois\. Registre à 0\./);
});
