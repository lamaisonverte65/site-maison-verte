import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';
import { accountingYearSummary } from '../src/services/accountingService.js';
import { buildFiscalSummary } from '../netlify/functions/_lib/accounting-fiscal-rules.js';

function input(extra={}) { return {
  year: 2026, bookings: [], payments: [], refundOperations: [],
  stripeBalanceTransactions: [], externalFinancials: [], accountingEntries: [],
  invoices: [], creditNotes: [], cleaningIssues: [], additionalCharges: [], ...extra,
}; }
const refund = { id: 'operation-1', booking_request_id: 'booking-1', status: 'succeeded',
  refunded_amount_cents: 1200, completed_at: '2026-10-18T11:45:00Z' };
const entry = { id: 'entry-1', booking_request_id: 'booking-1', entry_date: '2026-10-18',
  entry_kind: 'refund', amount_ttc: 12, source: 'stripe', source_record_key: 'direct:refund:operation-1' };

test('journal summary separates refund from operating expenses and deducts it from economic balance', () => {
  const result = accountingYearSummary([
    { entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 100 },
    { entry_date: '2026-06-02', entry_kind: 'expense', amount_ttc: 8 },
    { entry_date: '2026-06-03', entry_kind: 'refund', amount_ttc: 12 },
    { entry_date: '2025-06-03', entry_kind: 'refund', amount_ttc: 19 },
  ], 2026);
  assert.deepEqual(result, { income: 100, expense: 8, refunds: 12, result: 80, count: 3 });
});

test('unmatched refund entry remains negative and flagged without being called income or expense', () => {
  const result = buildAccountingReconciliation(input({ accountingEntries: [entry] }));
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.type, 'refund');
  assert.equal(row.grossKnownCents, 1200);
  assert.equal(row.signedAmountCents, -1200);
  assert.equal(row.netCents, -1200);
  assert.equal(row.status, 'a_verifier');
  assert.ok(row.reasons.includes('refund_origin_unlinked'));
  assert.equal(result.accountingSummary.refundsCents, 1200);
  assert.equal(result.accountingSummary.receiptsCents, 0);
  assert.equal(result.accountingSummary.expensesCents, 0);
});

test('refund rows must not increase fiscal pending gross amount', () => {
  const summary = buildFiscalSummary([
    { type: 'income', status: 'a_verifier', grossKnownCents: 10000 },
    { type: 'refund', status: 'a_verifier', grossKnownCents: 1200 },
  ], 2026);
  assert.equal(summary.pendingKnownGrossAmountCents, 10000);
  assert.equal(summary.pendingRows, 2);
});

test('coherent refund requires explicit refund entry, same year and exact cent amount', () => {
  const result = buildAccountingReconciliation(input({ refundOperations: [refund], accountingEntries: [entry] }));
  const row = result.rows[0];
  assert.equal(row.type, 'refund');
  assert.equal(row.accountingStatus, 'coherent');
  assert.deepEqual(row.accountingEntryIds, ['entry-1']);
  assert.equal(result.rows.length, 1);
  assert.equal(result.accountingSummary.refundsCents, 1200);
});

test('income entries cannot validate the repayment just by matching its amount and key', () => {
  const result = buildAccountingReconciliation(input({ refundOperations: [refund], accountingEntries: [
    {...entry, entry_kind: 'income'},
  ] }));
  assert.equal(result.rows[0].accountingStatus, 'a_verifier');
  assert.ok(result.rows[0].reasons.includes('refund_accounting_kind_invalid'));
});

test('manual ledger row cannot certify Stripe refund despite matching key', () => {
  const result = buildAccountingReconciliation(input({ refundOperations: [refund], accountingEntries: [
    {...entry, source: 'manual'},
  ] }));
  assert.equal(result.rows[0].accountingStatus, 'a_verifier');
  assert.ok(result.rows[0].reasons.includes('refund_accounting_source_invalid'));
});

test('refund entry in another exercise cannot reconcile as coherent', () => {
  const result = buildAccountingReconciliation(input({ refundOperations: [refund], accountingEntries: [
    {...entry, entry_date: '2025-12-31'},
  ] }));
  assert.equal(result.rows[0].accountingStatus, 'a_verifier');
  assert.ok(result.rows[0].reasons.includes('accounting_entry_year_mismatch'));
});

test('wrong refund amount at 1 cent is a mismatch (zero tolerance)', () => {
  const result = buildAccountingReconciliation(input({ refundOperations: [refund], accountingEntries: [
    {...entry, amount_ttc: 12.01},
  ] }));
  assert.equal(result.rows[0].accountingStatus, 'a_verifier');
  assert.ok(result.rows[0].reasons.includes('accounting_amount_mismatch'));
});

test('zero-euro accounting refund is flagged, not a transaction', () => {
  const result = buildAccountingReconciliation(input({ accountingEntries: [
    {...entry, amount_ttc: 0},
  ] }));
  assert.ok(result.rows[0].reasons.includes('refund_zero_amount'));
  assert.equal(result.accountingSummary.refundsCents, 0);
});

test('refund panel is read only: separate tab, no manual refund creation and no refunds in expense tab', () => {
  const source = fs.readFileSync('src/components/admin/DeclarationsPanel.jsx', 'utf8');
  assert.match(source, /\["refund",\s*"Remboursements"\]/);
  assert.match(source, /subtab === "refund"[\s\S]*?renderTable\(filteredJournalEntries/);
  const filters = fs.readFileSync('src/utils/accountingJournalFilters.js', 'utf8');
  assert.match(filters, /refund: \{ kind: "refund" \}/);
  assert.match(filters, /if \(kind && entry\.entry_kind !== kind\) return false/);
  // Depuis V4.14, Dépenses possède son propre écran d'analyse ;
  // seuls les entry_kind=expense y sont sélectionnés.
  assert.match(source, /subtab === "expense" && <ExpenseAnalysisPanel/);
  const analysis = fs.readFileSync('src/utils/expenseAnalysis.js', 'utf8');
  assert.match(analysis, /entry\.entry_kind !== "expense"/);
  assert.doesNotMatch(source, /openNew\("refund"\)|addDomain\("refund"\)/);
  assert.match(source, /entry\.source === "manual" && entry\.entry_kind !== "refund"/);
});

test('no refund Stripe creation or ledger insert from this read-only phase', () => {
  const files = [
    'src/services/accountingService.js',
    'src/components/admin/DeclarationsPanel.jsx',
    'netlify/functions/_lib/accounting-reconciliation.js',
    'netlify/functions/_lib/accounting-fiscal-rules.js',
  ];
  const joined = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(joined, /stripe\.refunds\.create\(/);
});
