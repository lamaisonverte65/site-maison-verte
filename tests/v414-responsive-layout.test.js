import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const declarations = fs.readFileSync("src/components/admin/DeclarationsPanel.jsx", "utf8");
const expenses = fs.readFileSync("src/components/admin/ExpenseAnalysisPanel.jsx", "utf8");
const css = fs.readFileSync("src/components/admin/declarationsV414Responsive.css", "utf8");

test("V4.14 R2 loads scoped responsive styles, and leaves other accounting dialogs unchanged", () => {
  assert.match(declarations, /import "\.\/declarationsV414Responsive\.css"/);
  assert.match(declarations, /className=\{inline \? "lmv-fee-form" : undefined\}/);
  assert.match(declarations, /className=\{inline \? "lmv-fee-form-fields" : undefined\}/);
  assert.match(css, /grid-template-areas:\s*"date domain supplier amount"/);
  assert.match(css, /@media \(max-width: 1020px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /grid-template-areas: "date" "domain" "label" "supplier" "amount" "payment" "receipt" "treatment"/);
});

test("V4.14 R2 mobile filters are collapsible but search is always accessible", () => {
  assert.match(expenses, /const \[showAdvancedFilters, setShowAdvancedFilters\] = useState\(false\)/);
  assert.match(expenses, /className="lmv-expense-search"/);
  assert.match(expenses, /aria-expanded=\{showAdvancedFilters\}/);
  assert.match(expenses, /className=\{`lmv-expense-filter-fields\$\{showAdvancedFilters \? " is-expanded" : ""\}`\}/);
  assert.match(css, /\.lmv-expense-filter-fields \{ display: none; \}/);
  assert.match(css, /\.lmv-expense-filter-fields\.is-expanded \{ display: grid; \}/);
});

test("V4.14 R2 offers compact category/month breakdowns and mobile journal cards with controls", () => {
  assert.match(expenses, /className="lmv-expense-breakdown-list"/);
  assert.match(expenses, /className="lmv-expense-breakdown-row"/);
  assert.match(expenses, /renderTable\(expenses, \{ showReceiptReference: true, responsiveCards: true \}\)/);
  assert.match(declarations, /className="lmv-journal-mobile"/);
  assert.match(declarations, /className="lmv-journal-card"/);
  assert.match(declarations, /className="lmv-journal-card-actions"/);
  assert.match(declarations, /onClick=\{\(\) => openEdit\(entry\)\}/);
  assert.match(declarations, /onClick=\{\(\) => remove\(entry\)\}/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.lmv-journal-desktop \{ display: none; \}/);
  assert.match(css, /\.lmv-journal-mobile \{ display: grid; gap: 12px; \}/);
});

test("V4.14 R2 declaration navigation has its own horizontal scroll on mobile", () => {
  assert.match(declarations, /className="lmv-declarations-toolbar"/);
  assert.match(declarations, /className="lmv-declarations-tabs"/);
  assert.match(declarations, /role="tablist"/);
  assert.match(declarations, /aria-selected=\{subtab === key\}/);
  assert.match(css, /\.lmv-declarations-tabs \{ flex: 0 0 auto; width: 100%; overflow-x: auto/);
});
