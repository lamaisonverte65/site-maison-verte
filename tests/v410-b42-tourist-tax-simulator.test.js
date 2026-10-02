import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pricingAdmin = read("src/components/PricingAdmin.jsx");
const endpoint = read("netlify/functions/save-price-rule.js");

test("B4.2 calculator compares current and proposed rules", () => {
  assert.match(pricingAdmin, /Calculateur de contrôle/);
  assert.match(pricingAdmin, /Règle actuelle/);
  assert.match(pricingAdmin, /Nouvelle règle/);
});

test("B4.2 simulator uses the shared production tourist-tax engine", () => {
  assert.match(endpoint, /calculateTouristTaxStay/);
  assert.match(endpoint, /from "\.\/_lib\/tourist-tax\.js"/);
  assert.match(endpoint, /simulate_tourist_tax_rule/);
});

test("B4.2 case includes nightly accommodation, nights, adults and exempt children", () => {
  assert.match(pricingAdmin, /Hébergement \/ nuit/);
  assert.match(pricingAdmin, />Nuits</);
  assert.match(pricingAdmin, /Adultes taxables/);
  assert.match(pricingAdmin, /Enfants exonérés/);
});

test("B4.2 returns exact formulas for fixed and proportional rules", () => {
  assert.match(endpoint, /Taxe = .*adulte\(s\) taxable\(s\).*nuit\(s\)/s);
  assert.match(endpoint, /base = arrondi/);
  assert.match(endpoint, /département/);
  assert.match(endpoint, /région/);
});

test("B4.2 creation requires a completed simulation", () => {
  assert.match(pricingAdmin, /Exécute au moins un cas test avant de valider/);
  assert.match(pricingAdmin, /disabled=\{saving \|\| !taxRuleModal\.simulationResult\}/);
});

test("B4.2 changing rule or case invalidates previous simulation", () => {
  assert.match(pricingAdmin, /simulationResult: null/);
  assert.match(pricingAdmin, /updateTaxRuleModal/);
});

test("B4.2 does not update or delete the previous rule", () => {
  const simulation = endpoint.match(/if \(action === "simulate_tourist_tax_rule"\)[\s\S]*?if \(action === "create_tourist_tax_rule"\)/)?.[0] || "";
  assert.ok(simulation);
  assert.doesNotMatch(simulation, /\.update\(/);
  assert.doesNotMatch(simulation, /\.delete\(/);
});

test("B4.2 does not require a new SQL migration", () => {
  assert.match(pricingAdmin, /Valider et programmer cette nouvelle règle/);
  assert.match(endpoint, /admin_add_tourist_tax_rule/);
});


test("B4.2 modal remains scrollable on short screens", () => {
  assert.match(pricingAdmin, /maxHeight: "calc\(100dvh - 36px\)"/);
  assert.match(pricingAdmin, /overflowY: "auto"/);
});

test("B4.2 shows proposed formula before running the comparison", () => {
  assert.match(pricingAdmin, /Formule de la nouvelle règle/);
  assert.match(pricingAdmin, /proposedTaxFormula\(taxRuleModal\)/);
  assert.match(pricingAdmin, /Taxe totale = .*adultes taxables.*nuits/);
});

test("B4.2 proportional preview exposes exact calculation stages", () => {
  assert.match(pricingAdmin, /Base \/ personne \/ nuit = arrondi au centime/);
  assert.match(pricingAdmin, /Base plafonnée = min/);
  assert.match(pricingAdmin, /Département = arrondi au centime/);
  assert.match(pricingAdmin, /Région = arrondi au centime/);
  assert.match(pricingAdmin, /Taxe totale = somme des taxes de chaque nuit/);
});
