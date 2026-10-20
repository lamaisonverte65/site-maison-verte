import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  filterExpenseEntries,
  summarizeExpenses,
  findPotentialDuplicateExpense,
} from "../src/utils/expenseAnalysis.js";
import {
  fetchAllAccountingEntries,
  createManualAccountingEntry,
  updateManualAccountingEntry,
} from "../src/services/accountingService.js";

const entries = [
  { id: "manual1", entry_date: "2026-01-08", entry_kind: "expense", category_id: "energy", amount_ttc: "33.33", counterparty: "Électricité EDF", label: "Janvier", source: "manual", metadata: { receipt_reference: "2026-01_EDF.pdf" }, accounting_categories: { name: "Énergie" } },
  { id: "auto1", entry_date: "2026-01-09", entry_kind: "expense", category_id: "bank", amount_ttc: "2.12", counterparty: "Stripe", label: "Frais de paiement", source: "stripe", accounting_categories: { name: "Frais Stripe / bancaires" } },
  { id: "manual2", entry_date: "2026-02-14", entry_kind: "expense", category_id: "energy", amount_ttc: "10.01", counterparty: "EDF", label: "Février", source: "manual", accounting_categories: { name: "Énergie" } },
  { id: "refund", entry_date: "2026-01-08", entry_kind: "refund", amount_ttc: "100.00", source: "stripe" },
  { id: "income", entry_date: "2026-01-08", entry_kind: "income", amount_ttc: "1000.00", source: "manual" },
  { id: "old", entry_date: "2025-01-08", entry_kind: "expense", amount_ttc: "200.00", source: "manual" },
];

test("V4.14 filters exclude refunds/income and combine year, month, category, supplier, source, text and dates", () => {
  assert.deepEqual(filterExpenseEntries(entries, { year: "2026" }).map((x) => x.id), ["manual1", "auto1", "manual2"]);
  assert.deepEqual(filterExpenseEntries(entries, { year: "2026", month: "01", categoryId: "energy", origin: "manual" }).map((x) => x.id), ["manual1"]);
  assert.deepEqual(filterExpenseEntries(entries, { year: "2026", supplier: "Electricite EDF" }).map((x) => x.id), ["manual1"]);
  assert.deepEqual(filterExpenseEntries(entries, { year: "2026", search: "EDF.PDF" }).map((x) => x.id), ["manual1"]);
  assert.deepEqual(filterExpenseEntries(entries, { year: "2026", origin: "automatic", startDate: "2026-01-09", endDate: "2026-01-09" }).map((x) => x.id), ["auto1"]);
  assert.deepEqual(filterExpenseEntries(entries, { year: "2026", startDate: "2026-03-01" }), []);
});

test("V4.14 totals in cents separate manual and auto, by category and by month, and ignore refund", () => {
  const total = summarizeExpenses(filterExpenseEntries(entries, { year: "2026" }));
  assert.equal(total.totalCents, 4546);
  assert.equal(total.manualCents, 4334);
  assert.equal(total.automaticCents, 212);
  assert.equal(total.count, 3);
  assert.deepEqual(total.categoryTotals, [{ label: "Énergie", cents: 4334 }, { label: "Frais Stripe / bancaires", cents: 212 }]);
  assert.deepEqual(total.monthTotals, [{ month: "2026-01", cents: 3545 }, { month: "2026-02", cents: 1001 }]);
  assert.equal(summarizeExpenses(filterExpenseEntries(entries, { year: "2026", origin: "manual" })).automaticCents, 0);
});

test("V4.14 duplicate warning only matches same date/amount/category and not the entry being edited", () => {
  const draft = { entry_date: "2026-01-08", entry_kind: "expense", amount_ttc: "33.33", category_id: "energy", label: "Electricite Janvier", counterparty: "Electricite EDF" };
  assert.equal(findPotentialDuplicateExpense(entries, draft)?.id, "manual1");
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, id: "manual1" }), null);
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, entry_date: "2026-01-09" }), null);
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, amount_ttc: "33.34" }), null);
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, category_id: "other" }), null);
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, entry_kind: "refund" }), null);
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, amount_ttc: "0" }), null);
  assert.equal(findPotentialDuplicateExpense(entries, { ...draft, entry_date: "2026-01-09", category_id: "bank", amount_ttc: "2.12", counterparty: "Stripe", label: "Autres frais Stripe" })?.id, "auto1");
});

test("V4.14 paginates all accounting entries with a stable three-column order", async () => {
  const calls = [];
  const db = { from(table) {
    assert.equal(table, "accounting_entries");
    return {
      select(fields) { assert.match(fields, /accounting_categories/); return this; },
      order(key, options) { calls.push(["order", key, options?.ascending]); return this; },
      async range(start, end) {
        calls.push(["range", start, end]);
        return { data: start === 0 ? [{ id: "a" }, { id: "b" }] : [{ id: "c" }], error: null };
      },
    };
  }};
  assert.deepEqual((await fetchAllAccountingEntries(db, 2)).map((e) => e.id), ["a", "b", "c"]);
  assert.deepEqual(calls.filter((c) => c[0] === "range"), [["range", 0, 1], ["range", 2, 3]]);
  assert.equal(calls.filter((c) => c[0] === "order" && c[1] === "id").length, 2);
});

test("V4.14 rejects paginated ledger errors instead of showing understated totals", async () => {
  const db = { from() { return {
    select() { return this; }, order() { return this; },
    async range() { return { error: { message: "Journal indisponible" }, data: null }; },
  }; } };
  await assert.rejects(fetchAllAccountingEntries(db), /Journal indisponible/);
});

test("V4.14 manual expense stores only a local document reference in metadata", async () => {
  let inserted;
  const db = { from(table) {
    assert.equal(table, "accounting_entries");
    return {
      insert(payload) { inserted = payload; return this; },
      select() { return this; },
      async single() { return { data: { id: "new", ...inserted }, error: null }; },
    };
  } };
  await createManualAccountingEntry(db, { entry_kind: "expense", entry_date: "2026-10-15", label: "EDF", amount_ttc: "125.40", receipt_reference: " 2026-10_EDF.pdf ", metadata: { legacy_field: "keep" } });
  assert.equal(inserted.source, "manual");
  assert.deepEqual(inserted.metadata, { legacy_field: "keep", receipt_reference: "2026-10_EDF.pdf" });
  assert.equal(inserted.amount_ttc, 125.4);
  assert.ok(!("file" in inserted));
});

test("V4.14 editing a manual entry clears only its reference and retains the manual guard", async () => {
  let updated;
  let assetDeleted = false;
  const db = { from(table) {
    if (table === "accounting_fixed_assets") return {
      delete() { return this; },
      async eq(key, value) { assert.equal(key, "accounting_entry_id"); assert.equal(value, "old"); assetDeleted = true; return { data: [], error: null }; },
    };
    assert.equal(table, "accounting_entries");
    return {
      update(payload) { updated = payload; return this; },
      eq(key, value) { assert.ok(["id", "source"].includes(key)); if (key === "source") assert.equal(value, "manual"); return this; },
      select() { return this; },
      async single() { return { data: { id: "old", ...updated }, error: null }; },
    };
  } };
  await updateManualAccountingEntry(db, "old", { entry_kind: "expense", entry_date: "2026-10-15", label: "EDF", amount_ttc: "125.40", receipt_reference: "", metadata: { receipt_reference: "OLD.pdf", legacy_field: true }, treatment: "current" });
  assert.deepEqual(updated.metadata, { legacy_field: true });
  assert.ok(assetDeleted);
});

test("V4.14 UI provides Frais and Dépenses without uploading receipts or writing another ledger", () => {
  const panel = fs.readFileSync("src/components/admin/DeclarationsPanel.jsx", "utf8");
  const dashboard = fs.readFileSync("src/components/admin/ExpenseAnalysisPanel.jsx", "utf8");
  assert.match(panel, /\["fees", "Frais"\]/);
  assert.match(panel, /subtab === "fees"/);
  assert.match(panel, /subtab === "expense" && <ExpenseAnalysisPanel/);
  assert.match(panel, /receipt_reference/);
  assert.match(panel, /Date réelle du paiement/);
  assert.match(dashboard, /Filtres du journal/);
  assert.match(dashboard, /Répartition par catégorie/);
  assert.match(dashboard, /Répartition par mois/);
  // The existing "Imports" tab legitimately uses a CSV file input.
  // The new Frais flow does not create a Supabase Storage integration.
  assert.doesNotMatch(dashboard, /storage\.from|type="file"/);
  assert.doesNotMatch(panel, /supabase\.storage|receipt_reference.*type="file"/);
});
