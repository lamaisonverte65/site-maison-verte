import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const pricingAdmin = read("src/components/PricingAdmin.jsx");
const endpoint = read("netlify/functions/save-price-rule.js");
const migration = read("supabase/migrations/202609290002_v410_tourist_tax_admin_versioning.sql");

test("B4.1 admin shows current classification and current rule", () => {
  assert.match(pricingAdmin, /Classement utilisé/);
  assert.match(pricingAdmin, /Règle en vigueur aujourd’hui/);
});

test("B4.1 classification change is independent from tax rules", () => {
  assert.match(endpoint, /update_tourist_tax_classification/);
  assert.match(endpoint, /tourist_tax_classification: classification/);
  assert.doesNotMatch(endpoint.match(/if \(action === "update_tourist_tax_classification"\)[\s\S]*?\n    }/s)?.[0] || "", /tourist_tax_rules/);
});

test("B4.1 admin tax catalog is protected by admin endpoint", () => {
  assert.match(endpoint, /authorizeAdminRequest/);
  assert.match(endpoint, /get_tourist_tax_config/);
  assert.match(endpoint, /from\("tourist_tax_rules"\)/);
});

test("B4.1 rule creation stores an effective start and no user-entered end", () => {
  assert.match(pricingAdmin, /Date de début d’application/);
  assert.match(pricingAdmin, /Aucune date de fin à saisir/);
  assert.doesNotMatch(pricingAdmin, /taxRuleModal\.effectiveTo/);
});

test("B4.1 SQL derives old rule end from the next rule", () => {
  assert.match(migration, /effective_to = p_effective_from - 1/);
  assert.match(migration, /v_next_start - 1/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test("B4.1 preserves created_at for late-entry reconciliation", () => {
  assert.match(endpoint, /created_at/);
  assert.match(pricingAdmin, /saisie le/);
  assert.match(migration, /created_at conserve la date réelle d'enregistrement/);
});

test("B4.1 does not rewrite booking snapshots", () => {
  assert.doesNotMatch(endpoint, /from\("booking_requests"\)/);
  assert.doesNotMatch(migration, /UPDATE public\.booking_requests/i);
});

test("B4.1 rule creation does not change property classification", () => {
  const block = endpoint.match(/if \(action === "create_tourist_tax_rule"\)[\s\S]*?return \{ statusCode: 200, body: JSON\.stringify\(\{ success: true, rule: data \}\) \};/s)?.[0] || "";
  assert.ok(block);
  assert.doesNotMatch(block, /pricing_settings/);
});
