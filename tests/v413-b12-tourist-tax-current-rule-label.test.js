import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pricingAdmin = read("src/components/PricingAdmin.jsx");
const endpoint = read("netlify/functions/save-price-rule.js");
const migration = read("supabase/migrations/202609290002_v410_tourist_tax_admin_versioning.sql");

test("V4.13 current tourist-tax rule summary uses the entry date for both displayed dates", () => {
  const summary = pricingAdmin.match(/Règle en vigueur aujourd’hui[\s\S]*?<\/div>/)?.[0] || "";
  assert.ok(summary, "Le résumé de la règle courante doit exister.");
  assert.match(summary, /Depuis le \{formatDate\(currentTaxRule\.created_at\)\}/);
  assert.match(summary, /saisie le \{formatDate\(currentTaxRule\.created_at\)\}/);
  assert.doesNotMatch(summary, /Depuis le \{formatDate\(currentTaxRule\.effective_from\)\}/);
});

test("V4.13 keeps effective_from for rule versioning and history", () => {
  assert.match(pricingAdmin, /rule\.effective_from/);
  assert.match(endpoint, /effectiveFrom/);
  assert.match(migration, /effective_from/);
});
