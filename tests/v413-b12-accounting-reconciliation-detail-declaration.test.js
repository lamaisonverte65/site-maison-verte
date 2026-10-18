import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

async function view() {
  const source = fs.readFileSync('src/utils/accountingReconciliationView.js', 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}
const makeRow = (id, fields = {}) => ({
  id, date: '2025-09-12', source: 'direct', type: 'receipt', status: 'coherent',
  fiscalStatus: 'coherent', financialStatus: 'coherent', accountingStatus: 'coherent',
  documentStatus: 'coherent', fiscalRelevant: true, fiscalCategory: 'tourist_furnished_unclassified',
  fiscalGrossAmountCents: 12000, grossKnownCents: 12300, touristTaxCents: 300,
  paymentFeeCents: 0, commissionCents: 0, netCents: 12300,
  fiscalAggregationKey: null, fiscalAnchor: false, bookingRequestId: 'booking-1',
  accountingEntryIds: [], invoiceIds: [], creditNoteIds: [], reasons: [], ...fields,
});
const makeSummary = (year = 2025, fields = {}) => ({
  incomeYear: year, declarant: 2, totalGrossAmountCents: 12000,
  pendingKnownGrossAmountCents: 0, pendingRows: 0,
  categories: [{ category: 'tourist_furnished_unclassified', incomeYear: year, declarationYear: year + 1,
    grossAmountCents: 12000, rowCount: 1, form: '2042-C-PRO',
    box: year === 2025 ? '5OH' : null, ruleStatus: year === 2025 ? 'confirmed' : 'form_pending',
    abatementRate: 0.30, microThresholdCents: 1500000 }], ...fields,
});

test('Task 9: fiscal categories are server-owned and amounts are compared to eligible whole rows', async () => {
  const { reviewAnnualDeclaration } = await view();
  const payload = { rows: [makeRow('a')], taxSummary: makeSummary() };
  const result = reviewAnnualDeclaration(payload, 2025);
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.integrityError, null);
  assert.equal(result.categories[0].grossAmountCents, 12000);
  assert.equal(result.totalGrossAmountCents, 12000);
  assert.equal(result.formReady, true);
  assert.equal(payload.taxSummary.categories[0].grossAmountCents, 12000, 'original server response unchanged');
});

test('Task 9: missing 2027 box never produces an invented 2025 code', async () => {
  const { reviewAnnualDeclaration } = await view();
  const result = reviewAnnualDeclaration({ rows: [makeRow('a')], taxSummary: makeSummary(2026) }, 2026);
  assert.equal(result.status, 'form_pending');
  assert.equal(result.formReady, false);
  assert.equal(result.categories[0].box, null);
});

test('Task 9: pending operations block complete declaration even if known subset is validated', async () => {
  const { reviewAnnualDeclaration } = await view();
  const pending = makeRow('p', { status: 'manquant', accountingStatus: 'manquant', fiscalStatus: 'a_verifier', fiscalGrossAmountCents: null, grossKnownCents: 4500 });
  const result = reviewAnnualDeclaration({ rows: [makeRow('a'), pending], taxSummary: makeSummary(2025, { pendingRows: 1, pendingKnownGrossAmountCents: 4500 }) }, 2025);
  assert.equal(result.status, 'pending');
  assert.equal(result.formReady, false);
  assert.equal(result.pendingRows, 1);
  assert.equal(result.pendingKnownGrossAmountCents, 4500);
});

test('Task 9: server category mismatch fails closed and is never labelled ready', async () => {
  const { reviewAnnualDeclaration } = await view();
  const result = reviewAnnualDeclaration({ rows: [makeRow('a')], taxSummary: makeSummary(2025, { totalGrossAmountCents: 12001 }) }, 2025);
  assert.equal(result.status, 'inconsistent');
  assert.equal(result.formReady, false);
  assert.ok(result.integrityError);
});

test('Task 9: negative, fractional, and unknown cents never become validated tax values', async () => {
  const { reviewAnnualDeclaration } = await view();
  for (const value of [null, -100, 12000.25]) {
    const result = reviewAnnualDeclaration({ rows: [makeRow('a')], taxSummary: makeSummary(2025, { categories: [{ ...makeSummary().categories[0], grossAmountCents: value }] }) }, 2025);
    assert.equal(result.status, 'inconsistent');
  }
});

test('Task 9: grouped direct payments count the fiscal amount once; inconsistent groups are excluded', async () => {
  const { reviewAnnualDeclaration } = await view();
  const a = makeRow('a', { grossKnownCents: 7500, fiscalGrossAmountCents: 0, fiscalAggregationKey: 'g', fiscalAnchor: false });
  const b = makeRow('b', { grossKnownCents: 4800, fiscalGrossAmountCents: 12000, fiscalAggregationKey: 'g', fiscalAnchor: true });
  const valid = reviewAnnualDeclaration({ rows: [a, b], taxSummary: makeSummary() }, 2025);
  assert.equal(valid.integrityError, null);
  assert.equal(valid.totalGrossAmountCents, 12000);
  const invalid = reviewAnnualDeclaration({ rows: [a, { ...b, status: 'a_verifier' }], taxSummary: makeSummary() }, 2025);
  assert.equal(invalid.status, 'inconsistent');
});

test('Task 9: a wrong exercise or unknown declarant/category cannot be accepted', async () => {
  const { reviewAnnualDeclaration } = await view();
  const samples = [
    { rows: [makeRow('a')], taxSummary: makeSummary(2026) },
    { rows: [makeRow('a')], taxSummary: makeSummary(2025, { declarant: 5 }) },
    { rows: [makeRow('a')], taxSummary: makeSummary(2025, {
      categories: [{ ...makeSummary().categories[0], category: 'undefined_tax_category' }],
    }) },
  ];
  for (const payload of samples) {
    const result = reviewAnnualDeclaration(payload, 2025);
    assert.equal(result.status, 'inconsistent');
    assert.equal(result.formReady, false);
  }
});

test('Task 9: even a complete subset is never treated as ready if all annual rows are pending', async () => {
  const { reviewAnnualDeclaration } = await view();
  const pending = makeRow('refund', { type: 'refund', status: 'a_verifier', fiscalStatus: 'a_verifier', fiscalGrossAmountCents: null });
  const summary = makeSummary(2025, { categories: [], totalGrossAmountCents: 0,
    pendingKnownGrossAmountCents: 12300, pendingRows: 1 });
  const result = reviewAnnualDeclaration({ rows: [pending], taxSummary: summary }, 2025);
  assert.equal(result.status, 'pending');
  assert.equal(result.formReady, false);
});

test('Task 9: unknown reason codes are visibly labelled rather than silently lost', async () => {
  const { explainReconciliationReasons } = await view();
  const reasons = explainReconciliationReasons(['accounting_amount_mismatch', 'tourist_tax_cross_year_allocation_unknown', 'new_reason_from_server']);
  assert.equal(reasons.length, 3);
  assert.match(reasons[0].label, /[ée]cart|montant/i);
  assert.match(reasons[1].description, /ann[ée]e|exercice/i);
  assert.match(reasons[2].label, /new_reason_from_server/);
});

test('Task 9: no reasons means no artificial success explanation for contradictory status', async () => {
  const { explainReconciliationReasons } = await view();
  assert.deepEqual(explainReconciliationReasons([]), []);
});

test('Task 9: detail and declaration UI are accessible, read-only, and visible on mobile', () => {
  const panel = fs.readFileSync('src/components/admin/AccountingReconciliationPanel.jsx', 'utf8');
  const css = fs.readFileSync('src/components/admin/accountingReconciliation.css', 'utf8');
  assert.match(panel, /Pr[ée]paration de la d[ée]claration/);
  assert.match(panel, /reviewAnnualDeclaration/);
  assert.match(panel, /explainReconciliationReasons/);
  assert.match(panel, /aria-expanded/);
  assert.match(panel, /Fermer le d[ée]tail/);
  assert.match(panel, /accountingEntryIds/);
  assert.match(panel, /creditNoteIds/);
  assert.match(panel, /fiscalStatus/);
  assert.match(css, /\.lmv-reconciliation-detail/);
  assert.match(css, /@media \(max-width: 760px\)/);
  const parent = fs.readFileSync('src/components/admin/DeclarationsPanel.jsx', 'utf8');
  assert.doesNotMatch(parent, /!reconciliation\.rows\.length/);
  assert.doesNotMatch(panel, /\.from\(|\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test('Audit B1: the three new reconciliation blockers have a clear French explanation', async () => {
  const { explainReconciliationReasons } = await view();
  const labels = explainReconciliationReasons([
    'accounting_income_unlinked',
    'accounting_income_amount_not_demonstrated',
    'platform_tourist_tax_derived_not_demonstrated',
  ]);
  assert.equal(labels.length, 3);
  assert.ok(labels.every((item) => !item.label.startsWith('Motif non traduit')));
  assert.match(labels[2].description, /diff[ée]rence arithm[ée]tique/i);
});
