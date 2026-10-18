import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const path = 'src/utils/accountingReconciliationView.js';
async function utils() {
  const source = fs.readFileSync(path, 'utf8');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`);
}
const row = (id, properties = {}) => ({
  id, date: '2026-09-09', source: 'direct', type: 'receipt', status: 'coherent',
  fiscalStatus: 'coherent', financialStatus: 'coherent', accountingStatus: 'coherent',
  documentStatus: 'coherent', fiscalRelevant: true,
  fiscalCategory: 'tourist_furnished_unclassified',
  grossKnownCents: 10000, signedAmountCents: 10000, netCents: 9800,
  touristTaxCents: 200, commissionCents: 0, paymentFeeCents: 200,
  fiscalGrossAmountCents: 9800, fiscalAggregationKey: null,
  fiscalAnchor: false, bookingRequestId: 'booking-1', externalReference: null,
  reasons: [], ...properties,
});

test('Task 8: source, type, status, fiscal category and identifier text filters are cumulative', async () => {
  const { filterReconciliationRows } = await utils();
  const rows = [
    row('a', { source: 'booking', type: 'receipt', status: 'a_verifier', fiscalCategory: null, externalReference: '12345' }),
    row('b', { source: 'booking', type: 'expense', status: 'a_verifier', fiscalCategory: null }),
    row('c', { source: 'airbnb', type: 'receipt', status: 'a_verifier', fiscalCategory: null }),
    row('d', { source: 'booking', type: 'receipt', status: 'coherent', fiscalCategory: null }),
  ];
  assert.deepEqual(filterReconciliationRows(rows, { source: 'booking', type: 'receipt', status: 'a_verifier', fiscalCategory: 'unknown', query: '12345' }).map(r => r.id), ['a']);
  assert.deepEqual(filterReconciliationRows(rows, { fiscalCategory: 'unknown' }).map(r => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(filterReconciliationRows(rows, { query: 'NOT-FOUND' }), []);
});

test('Task 8: coherent, anomalies, and ready-for-tax scopes are independent of the active filters', async () => {
  const { filterReconciliationRows } = await utils();
  const rows = [
    row('ready'),
    row('unknown-fiscal', { status: 'a_verifier', fiscalStatus: 'a_verifier', fiscalGrossAmountCents: null }),
    row('missing', { status: 'manquant', accountingStatus: 'manquant' }),
    row('expense', { type: 'expense', fiscalRelevant: false, fiscalStatus: 'non_applicable', fiscalGrossAmountCents: null }),
  ];
  assert.deepEqual(filterReconciliationRows(rows, { scope: 'coherent' }).map(r => r.id), ['ready', 'expense']);
  assert.deepEqual(filterReconciliationRows(rows, { scope: 'anomalies' }).map(r => r.id), ['unknown-fiscal', 'missing']);
  assert.deepEqual(filterReconciliationRows(rows, { scope: 'ready' }).map(r => r.id), ['ready']);
  assert.deepEqual(filterReconciliationRows(rows, { scope: 'ready', type: 'expense' }).map(r => r.id), []);
});

test('Task 8: default order prioritizes review then missing then coherent; dates descending and identifiers deterministic', async () => {
  const { sortReconciliationRows } = await utils();
  const rows = [
    row('ok', { status: 'coherent', date: '2026-12-25' }),
    row('missing', { status: 'manquant', date: '2026-11-01' }),
    row('review-old', { status: 'a_verifier', date: '2026-04-01' }),
    row('review-new', { status: 'a_verifier', date: '2026-10-01' }),
    row('review-no-date', { status: 'a_verifier', date: null }),
  ];
  const originalOrder = rows.map(r => r.id);
  assert.deepEqual(sortReconciliationRows(rows, 'priority_date').map(r => r.id), ['review-new', 'review-old', 'review-no-date', 'missing', 'ok']);
  assert.deepEqual(rows.map(r => r.id), originalOrder, 'sorting must not mutate server response');
});

test('Task 8: date and amount sorts keep null amounts last, regardless of direction', async () => {
  const { sortReconciliationRows } = await utils();
  const rows = [row('null', { grossKnownCents: null }), row('small', { grossKnownCents: 100 }), row('big', { grossKnownCents: 1000 })];
  assert.deepEqual(sortReconciliationRows(rows, 'amount_desc').map(r => r.id), ['big', 'small', 'null']);
  assert.deepEqual(sortReconciliationRows(rows, 'amount_asc').map(r => r.id), ['small', 'big', 'null']);
});

test('Task 8: displayed totals separate receipts, refunds, costs and fees with exact integer cents', async () => {
  const { summarizeVisibleReconciliationRows } = await utils();
  const entries = [
    row('receipt', { grossKnownCents: 12001, commissionCents: 1100, paymentFeeCents: 201, netCents: 10700, touristTaxCents: 201, fiscalGrossAmountCents: 11800 }),
    row('refund', { type: 'refund', status: 'a_verifier', fiscalStatus: 'a_verifier', grossKnownCents: 2000, netCents: -2000, paymentFeeCents: null, touristTaxCents: null, fiscalGrossAmountCents: null }),
    row('expense', { type: 'expense', fiscalRelevant: false, fiscalStatus: 'non_applicable', grossKnownCents: 3001, netCents: -3001, paymentFeeCents: 0, touristTaxCents: null, fiscalGrossAmountCents: null }),
  ];
  const total = summarizeVisibleReconciliationRows(entries, entries);
  assert.equal(total.rowCount, 3);
  assert.equal(total.receiptsCents, 12001);
  assert.equal(total.refundsCents, 2000);
  assert.equal(total.expensesCents, 3001);
  assert.equal(total.commissionsCents, 1100);
  assert.equal(total.paymentFeesCents, 201);
  assert.equal(total.touristTaxCents, 201);
  assert.equal(total.economicNetCents, 5699);
  assert.equal(total.fiscalValidatedCents, 11800);
  assert.equal(total.fiscalPendingKnownReceiptsCents, 0);
  assert.equal(total.fiscalPendingKnownRefundsCents, 2000);
  assert.deepEqual(total.statuses, { coherent: 2, manquant: 0, a_verifier: 1 });
});

test('Task 8: unknown amounts stay unknown, not silently converted into zero', async () => {
  const { summarizeVisibleReconciliationRows } = await utils();
  const entries = [row('missing', { grossKnownCents: null, netCents: null, touristTaxCents: null, fiscalGrossAmountCents: null, status: 'a_verifier', fiscalStatus: 'a_verifier' })];
  const total = summarizeVisibleReconciliationRows(entries, entries);
  assert.equal(total.receiptsCents, 0);
  assert.equal(total.unknownGrossCount, 1);
  assert.equal(total.unknownNetCount, 1);
  assert.equal(total.unknownTouristTaxCount, 1);
  assert.equal(total.fiscalUnknownCount, 1);
  assert.equal(total.fiscalValidatedCents, 0);
});

test('Task 8: a filter hiding one payment cannot make a multi-payment fiscal group look fully validated', async () => {
  const { summarizeVisibleReconciliationRows } = await utils();
  const all = [
    row('advance', { fiscalAggregationKey: 'direct-booking:b:2026', fiscalAnchor: false, fiscalGrossAmountCents: 0, grossKnownCents: 3000, type: 'receipt' }),
    row('balance', { fiscalAggregationKey: 'direct-booking:b:2026', fiscalAnchor: true, fiscalGrossAmountCents: 9500, grossKnownCents: 6700, type: 'receipt' }),
  ];
  assert.equal(summarizeVisibleReconciliationRows(all, all).fiscalValidatedCents, 9500);
  const partial = summarizeVisibleReconciliationRows([all[1]], all);
  assert.equal(partial.fiscalValidatedCents, 0);
  assert.equal(partial.fiscalIncompleteGroupCount, 1);
  assert.equal(partial.fiscalPendingKnownReceiptsCents, 6700);
  assert.equal(summarizeVisibleReconciliationRows([all[0]], all).fiscalValidatedCents, 0);
});

test('Task 8: inconsistent status within a full multi-payment group never contributes to fiscal validated totals', async () => {
  const { summarizeVisibleReconciliationRows } = await utils();
  const all = [
    row('advance', { fiscalAggregationKey: 'g', fiscalAnchor: false, fiscalGrossAmountCents: 0, status: 'manquant' }),
    row('balance', { fiscalAggregationKey: 'g', fiscalAnchor: true, fiscalGrossAmountCents: 19800 }),
  ];
  assert.equal(summarizeVisibleReconciliationRows(all, all).fiscalValidatedCents, 0);
  assert.equal(summarizeVisibleReconciliationRows(all, all).fiscalPendingKnownReceiptsCents, 20000);
});


test('Task 8: ready-for-tax scope refuses a partial or contradictory direct fiscal group', async () => {
  const { filterReconciliationRows } = await utils();
  const all = [
    row('advance', { fiscalAggregationKey: 'g', fiscalAnchor: false, fiscalGrossAmountCents: 0, status: 'manquant' }),
    row('balance', { fiscalAggregationKey: 'g', fiscalAnchor: true, fiscalGrossAmountCents: 19800 }),
    row('ordinary'),
  ];
  assert.deepEqual(filterReconciliationRows(all, { scope: 'ready' }).map(r => r.id), ['ordinary']);
});

test('Task 8: an exact reference search is accent/case insensitive and keeps the server rows unchanged', async () => {
  const { filterReconciliationRows } = await utils();
  const all = [row('a', { externalReference: 'ABC-123' }), row('b', { bookingRequestId: 'Réservation-456' })];
  assert.deepEqual(filterReconciliationRows(all, { query: 'abc-123' }).map(r => r.id), ['a']);
  assert.deepEqual(filterReconciliationRows(all, { query: 'réservation-456' }).map(r => r.id), ['b']);
  assert.equal(all[0].externalReference, 'ABC-123');
});
