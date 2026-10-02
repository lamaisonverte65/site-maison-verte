import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(path, "utf8");

test("B4.3.1B declarations replaces the placeholder with accounting UI", () => {
  const admin = read("src/pages/Admin.jsx");
  assert.match(
    admin,
    /const DeclarationsPanel = lazy\(\(\) => import\("\.\.\/components\/admin\/DeclarationsPanel"\)\);/,
  );
  assert.match(admin, /activeTab === "declarations"/);
  assert.match(admin, /<DeclarationsPanel \/>/);
  assert.doesNotMatch(admin, /Espace réservé aux déclarations/);
});

test("B4.3.1B accounting UI exposes agreed manual workflow", () => {
  const panel = read("src/components/admin/DeclarationsPanel.jsx");
  for (const label of ["Synthèse", "Recettes", "Dépenses", "Immobilisations", "Imports", "Taxe de séjour", "+ Ajouter un domaine", "+ Ajouter "]) assert.match(panel, new RegExp(label.replace(/[+]/g, "\\+")));
  assert.match(panel, /source === "manual"/);
  assert.match(panel, /Aucun amortissement fiscal n'est calculé automatiquement/);
});

test("B4.3.1B accounting service protects manual mutations and import idempotence stays database-owned", () => {
  const service = read("src/services/accountingService.js");
  assert.match(service, /source: "manual"/);
  assert.match(service, /\.eq\("source", "manual"\)/);
  assert.match(service, /accounting_fixed_assets/);
  assert.match(service, /accountingYearSummary/);
});
