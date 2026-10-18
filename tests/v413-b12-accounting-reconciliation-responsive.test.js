import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync('src/components/admin/DeclarationsPanel.jsx', 'utf8');
const componentPath = 'src/components/admin/AccountingReconciliationPanel.jsx';
const cssPath = 'src/components/admin/accountingReconciliation.css';

test('Task 8: dedicated reconciliation component, without altering existing non-reconciliation tabs', () => {
  assert.ok(fs.existsSync(componentPath));
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(panel, /import ReconciliationTableView from/);
  assert.match(panel, /subtab === "reconciliation" && <AccountingReconciliationPanel/);
  assert.doesNotMatch(source, /createManualAccountingEntry|deleteManualAccountingEntry|saveAccountingImportSnapshot|fetchAccountingData/);
  assert.match(source, /filterReconciliationRows/);
  assert.match(source, /sortReconciliationRows/);
  assert.match(source, /summarizeVisibleReconciliationRows/);
  assert.match(source, /Montants inconnus|montants inconnus/);
  assert.match(source, /non déduit/i);
});

test('Task 8: filters have labels and an explicit reset; mobile uses cards rather than an unreadable table', () => {
  assert.ok(fs.existsSync(cssPath));
  const source = fs.readFileSync(componentPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(source, /<label/);
  assert.match(source, /Réinitialiser les filtres/);
  assert.match(source, /lmv-reconciliation-table/);
  assert.match(source, /lmv-reconciliation-mobile-list/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /\.lmv-reconciliation-table\s*\{\s*display:\s*none/);
  assert.match(css, /\.lmv-reconciliation-mobile-list\s*\{\s*display:\s*grid/);
});

test('Task 8: dashboard shows an explicitly filtered subtotal separate from the year-wide summary', () => {
  const source = fs.readFileSync(componentPath, 'utf8');
  assert.match(source, /Exercice complet/);
  assert.match(source, /Sélection filtrée/);
  assert.match(source, /Commissions/);
  assert.match(source, /Frais de paiement/);
  assert.match(source, /Montant fiscal démontré/);
  assert.match(source, /À vérifier/);
  assert.match(source, /Aucune opération ne correspond aux filtres/);
});
