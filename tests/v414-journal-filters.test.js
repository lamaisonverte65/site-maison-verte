import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EMPTY_JOURNAL_FILTERS, JOURNAL_TAB_SCOPES,
  filterAccountingJournalEntries, journalFilterOptions,
} from "../src/utils/accountingJournalFilters.js";
import { accountingYearSummary } from "../src/services/accountingService.js";

const entries = [
  { id: "income", entry_date: "2026-01-10", entry_kind: "income", label: "Nuitée", amount_ttc: 300,
    category_id: "stays", accounting_categories: { name: "Séjours" }, counterparty: "André Dupont", source: "booking", treatment: "current" },
  { id: "manualFee", entry_date: "2026-02-12", entry_kind: "expense", label: "Facture énergie", amount_ttc: 40,
    category_id: "energy", accounting_categories: { name: "Énergie" }, counterparty: "Électricité EDF", source: "manual", treatment: "current", metadata: { receipt_reference: "facture-EDF.pdf" } },
  { id: "automaticFee", entry_date: "2026-01-12", entry_kind: "expense", label: "Frais Stripe", amount_ttc: 6,
    category_id: "bank", accounting_categories: { name: "Frais bancaires" }, counterparty: "Stripe", source: "stripe", treatment: "current" },
  { id: "asset", entry_date: "2026-03-01", entry_kind: "expense", label: "Achat réfrigérateur", amount_ttc: 100,
    category_id: "equipment", accounting_categories: { name: "Équipement" }, counterparty: "Magasin", source: "manual", treatment: "fixed_asset" },
  { id: "refund", entry_date: "2026-01-15", entry_kind: "refund", label: "Remboursement client", amount_ttc: 25,
    source: "stripe", counterparty: "André Dupont", treatment: "current" },
  { id: "old", entry_date: "2025-01-10", entry_kind: "expense", label: "Ancien frais", amount_ttc: 75,
    source: "manual", treatment: "current" },
];
const ids = (result) => result.map((entry) => entry.id);
const scoped = (tab, filters = {}) => filterAccountingJournalEntries(entries, { year: "2026", ...JOURNAL_TAB_SCOPES[tab], ...filters });

test("les 5 onglets ont chacun un périmètre strict, année comprise", () => {
  assert.deepEqual(ids(scoped("summary")), ["income", "manualFee", "automaticFee", "asset", "refund"]);
  assert.deepEqual(ids(scoped("income")), ["income"]);
  assert.deepEqual(ids(scoped("refund")), ["refund"]);
  assert.deepEqual(ids(scoped("fees")), ["manualFee", "asset"]);
  assert.deepEqual(ids(scoped("assets")), ["asset"]);
  assert.deepEqual(ids(scoped("fees", { source: "stripe" })), []);
  assert.deepEqual(ids(scoped("refund", { entryKind: "expense" })), []);
  assert.deepEqual(ids(scoped("assets", { treatment: "current" })), []);
});

test("recherche normalisée, justificatif local et filtres cumulables", () => {
  assert.deepEqual(ids(scoped("summary", { search: "ANDRE dupont" })), ["income", "refund"]);
  assert.deepEqual(ids(scoped("fees", { search: "facture-edf.pdf" })), ["manualFee"]);
  assert.deepEqual(ids(scoped("fees", { counterparty: "ELECTRICITE EDF" })), ["manualFee"]);
  assert.deepEqual(ids(scoped("summary", { month: "01", categoryId: "bank", source: "stripe" })), ["automaticFee"]);
  assert.deepEqual(ids(scoped("summary", { source: "automatic", entryKind: "refund" })), ["refund"]);
  assert.deepEqual(ids(scoped("summary", { entryKind: "expense", source: "automatic" })), ["automaticFee"]);
  assert.deepEqual(ids(scoped("summary", { startDate: "2026-02-01", endDate: "2026-02-28" })), ["manualFee"]);
  assert.deepEqual(ids(scoped("summary", { startDate: "2026-04-01" })), []);
  assert.deepEqual(ids(scoped("summary", { treatment: "fixed_asset" })), ["asset"]);
});

test("les sommes filtrées conservent les remboursements hors des charges", () => {
  const all = accountingYearSummary(scoped("summary"), "2026");
  assert.deepEqual(all, { income: 300, expense: 146, refunds: 25, result: 129, count: 5 });
  assert.deepEqual(accountingYearSummary(scoped("summary", { month: "01" }), "2026"), {
    income: 300, expense: 6, refunds: 25, result: 269, count: 3,
  });
  assert.equal(accountingYearSummary(scoped("summary", { entryKind: "expense" }), "2026").refunds, 0);
  assert.deepEqual(EMPTY_JOURNAL_FILTERS, { search: "", month: "", categoryId: "", counterparty: "", source: "", entryKind: "", treatment: "", startDate: "", endDate: "" });
});

test("les options sont limitées à l'exercice et au périmètre de l'onglet", () => {
  const fees = journalFilterOptions(entries, { year: "2026", ...JOURNAL_TAB_SCOPES.fees });
  assert.deepEqual(fees.sources, ["manual"]);
  assert.deepEqual(fees.categories.map(([, label]) => label), ["Énergie", "Équipement"]);
  assert.ok(!fees.counterparties.includes("Stripe"));
  assert.ok(!fees.counterparties.includes("André Dupont"));
});

test("navigation et affichage mobile utilisent les filtres sans changer les services", () => {
  const panel = readFileSync("src/components/admin/DeclarationsPanel.jsx", "utf8");
  const filterUi = readFileSync("src/components/admin/AccountingJournalFilters.jsx", "utf8");
  const css = readFileSync("src/components/admin/declarationsV414Responsive.css", "utf8");
  for (const tab of ["summary", "income", "refund", "fees", "assets"]) {
    assert.match(panel, new RegExp(`subtab === "${tab}"`));
    assert.match(readFileSync("src/utils/accountingJournalFilters.js", "utf8"), new RegExp(`\\b${tab}: \\{`));
  }
  assert.match(panel, /<AccountingJournalFilters/);
  assert.match(panel, /summaryEntries = subtab === "summary" \? filteredJournalEntries : data.entries/);
  assert.match(panel, /subtab === "expense" && <ExpenseAnalysisPanel/);
  assert.match(panel, /subtab === "tax" && <TouristTaxDeclarationPanel year=\{year\}/);
  assert.match(panel, /subtab === "reconciliation" && <AccountingReconciliationPanel/);
  assert.match(filterUi, /aria-expanded=\{showAdvanced\}/);
  assert.match(filterUi, /className="lmv-accounting-filter-search"/);
  assert.match(css, /\.lmv-accounting-filter-fields \{ display: none; \}/);
  assert.match(css, /\.lmv-accounting-filter-fields\.is-expanded \{ display: grid; \}/);
  assert.doesNotMatch(readFileSync("src/utils/accountingJournalFilters.js", "utf8"), /supabase|\.insert\(|\.update\(|\.delete\(/);
});
