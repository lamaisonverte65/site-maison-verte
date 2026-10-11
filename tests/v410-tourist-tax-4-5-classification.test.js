import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const migration = read("supabase/migrations/202610080001_v410_tourist_tax_4_5_and_dated_classification.sql");
const endpoint = read("netlify/functions/save-price-rule.js");
const pricingAdmin = read("src/components/PricingAdmin.jsx");
const quote = read("netlify/functions/_lib/booking-quote.js");
const rules = read("netlify/functions/_lib/tourist-tax-rules.js");
const declaration = read("netlify/functions/_lib/tourist-tax-declaration.js");

test("tourist tax supports classifications from unclassified through 5 stars everywhere", () => {
  for (const classification of ["4_star", "5_star"]) {
    assert.match(migration, new RegExp(classification));
    assert.match(endpoint, new RegExp(classification));
    assert.match(pricingAdmin, new RegExp(classification));
    assert.match(quote, new RegExp(classification));
    assert.match(rules, new RegExp(classification));
    assert.match(declaration, new RegExp(classification));
  }
});

test("2026 4-star and 5-star Aure-Louron fixed rates are seeded", () => {
  assert.match(migration, /'4_star','fixed',NULL,NULL,NULL,NULL,360/);
  assert.match(migration, /'5_star','fixed',NULL,NULL,NULL,NULL,475/);
});

test("classification changes go through the dated history RPC and are server-only", () => {
  assert.match(endpoint, /admin_set_tourist_tax_classification/);
  assert.match(endpoint, /p_effective_from: effectiveFrom/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_set_tourist_tax_classification\(text,date,text\) TO service_role/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_set_tourist_tax_classification\(text,date,text\) FROM PUBLIC, anon, authenticated/);
});

test("classification history is closed the day before the new classification", () => {
  assert.match(migration, /effective_to=p_effective_from-1/);
  assert.match(migration, /effective_from',p_effective_from/);
});
