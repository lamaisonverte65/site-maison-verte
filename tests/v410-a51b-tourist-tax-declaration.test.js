import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildTouristTaxDeclarationRows, summarizeTouristTaxDeclaration } from "../netlify/functions/_lib/tourist-tax-declaration.js";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

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

test("A-5.1b uses the stored nightly snapshot as historical authority", () => {
  const rows = buildTouristTaxDeclarationRows({ bookings: [booking] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].snapshotTaxCents, 362);
  assert.equal(rows[0].snapshotRuleId, "commercial");
  assert.equal(rows[0].status, "ok");
});

test("A-5.1b splits a cross-month stay by stored night", () => {
  const rows = buildTouristTaxDeclarationRows({ bookings: [booking] });
  const january = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 1 });
  const february = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 2 });
  assert.equal(january.totals.nights, 1);
  assert.equal(february.totals.nights, 1);
  assert.equal(january.totals.snapshotTaxCents, 362);
  assert.equal(february.totals.snapshotTaxCents, 362);
});

test("A-5.1b keeps platform collection outside LMV declaration totals", () => {
  const rows = buildTouristTaxDeclarationRows({ bookings: [{ ...booking, id: "platform", tourist_tax_collector: "platform" }] });
  const january = summarizeTouristTaxDeclaration(rows, { year: 2026, month: 1 });
  assert.equal(january.totals.nights, 0);
  assert.equal(january.totals.platformNights, 1);
  assert.equal(january.totals.snapshotTaxCents, 0);
});

test("A-5.1b exposes an incomplete stored snapshot instead of inventing a tax", () => {
  const incomplete = {
    ...booking,
    tourist_tax_snapshot: {
      ...booking.tourist_tax_snapshot,
      nights: [{ date: "2026-01-31", accommodationCents: 10000, totalTaxCents: null, rule: { id: "commercial" } }],
    },
  };
  const rows = buildTouristTaxDeclarationRows({ bookings: [incomplete] });
  assert.equal(rows[0].snapshotTaxCents, null);
  assert.equal(rows[0].status, "missing_snapshot_data");
});

test("A-5.1b endpoint is owner-only and reads the regulatory catalog without writing to historical bookings", () => {
  const endpoint = read("netlify/functions/admin-tourist-tax-declaration.js");
  assert.match(endpoint, /ownerOnly: true/);
  assert.match(endpoint, /tourist_tax_classification_history/);
  assert.match(endpoint, /tourist_tax_rules/);
  assert.doesNotMatch(endpoint, /\.insert\(/);
  assert.doesNotMatch(endpoint, /\.update\(/);
  assert.doesNotMatch(endpoint, /\.delete\(/);
  assert.doesNotMatch(endpoint, /\.rpc\(/);
});

test("A-5.1b UI distinguishes historical snapshot and current regulatory calculation", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  assert.match(panel, /Taxe de séjour — Aure Louron/);
  assert.match(panel, /Taxe enregistrée/);
  assert.match(panel, /Taxe indicative à déclarer/);
  assert.match(panel, /Plateformes — contrôle uniquement/);
  assert.match(panel, /Aucune nuitée directe LMV à déclarer pour ce mois\. Registre à 0\./);
});
