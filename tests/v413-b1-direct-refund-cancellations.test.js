import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';

const base = (extra = {}) => ({
  year: 2026, bookings: [], payments: [], refundOperations: [],
  stripeBalanceTransactions: [], externalFinancials: [], accountingEntries: [],
  invoices: [], creditNotes: [], cleaningIssues: [], additionalCharges: [],
  ...extra,
});

function cancelledNoPayment(id, day) {
  return {
    booking: { id, status: 'cancelled', payment_status: 'unpaid', amount_paid: 0 },
    operation: {
      id: `refund-${id}`, booking_request_id: id, action: 'cancel_refund',
      status: 'succeeded', refunded_amount_cents: 0,
      completed_at: `2026-10-${day}T12:00:00Z`,
    },
  };
}

test('two succeeded cancellation-only operations without payment do not become financial refunds', () => {
  const cases = [cancelledNoPayment('test-cancel-a', '06'), cancelledNoPayment('test-cancel-b', '16')];
  const result = buildAccountingReconciliation(base({
    bookings: cases.map(x => x.booking),
    refundOperations: cases.map(x => x.operation),
  }));
  assert.deepEqual(result.rows, []);
  assert.equal(result.accountingSummary.rowCount, 0);
  assert.equal(result.accountingSummary.refundsCents, 0);
  assert.deepEqual(result.accountingSummary.statuses, { coherent: 0, manquant: 0, a_verifier: 0 });
  assert.equal(result.taxSummary.pendingRows, 0);
});

test('zero-euro cancellation after a paid receipt is not a fake refund nor a fiscal block', () => {
  const booking = {
    id: 'paid-booking', tourist_tax_snapshot: { classification: 'unclassified', totalTaxCents: 800 },
  };
  const payment = {
    id: 'payment', booking_request_id: booking.id, status: 'paid',
    amount: 238, paid_at: '2026-10-03T10:00:00Z',
  };
  const result = buildAccountingReconciliation(base({
    bookings: [booking],
    payments: [payment],
    refundOperations: [{
      id: 'zero-operation', booking_request_id: booking.id, status: 'succeeded',
      refunded_amount_cents: 0, completed_at: '2026-10-16T10:00:00Z',
    }],
    accountingEntries: [{
      id: 'linked', booking_request_id: booking.id, source_record_key: 'direct:payment:payment',
      entry_kind: 'income', entry_date: '2026-10-03', amount_ttc: 238,
    }],
  }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, 'direct-payment:payment');
  assert.equal(result.rows[0].fiscalStatus, 'coherent');
  assert.equal(result.rows[0].fiscalGrossAmountCents, 23000);
  assert.equal(result.accountingSummary.refundsCents, 0);
  assert.equal(result.taxSummary.totalGrossAmountCents, 23000);
});

test('a real one-cent refund stays visible and needs separate accounting and fiscal review', () => {
  const result = buildAccountingReconciliation(base({
    refundOperations: [{
      id: 'refund-one-cent', booking_request_id: 'b', status: 'succeeded',
      refunded_amount_cents: 1, completed_at: '2026-10-16T10:00:00Z',
    }],
  }));
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.type, 'refund');
  assert.equal(row.signedAmountCents, -1);
  assert.equal(row.accountingStatus, 'manquant');
  assert.equal(row.status, 'manquant');
  assert.equal(result.accountingSummary.refundsCents, 1);
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingRows, 1);
});

test('refund with unknown amount is retained for investigation, unlike an explicit zero', () => {
  const result = buildAccountingReconciliation(base({
    refundOperations: [{
      id: 'unknown-refund', booking_request_id: 'b', status: 'succeeded',
      refunded_amount_cents: null, completed_at: '2026-10-16T10:00:00Z',
    }],
  }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].grossKnownCents, null);
  assert.equal(result.rows[0].financialStatus, 'a_verifier');
  assert.equal(result.rows[0].accountingStatus, 'manquant');
  assert.equal(result.rows[0].status, 'manquant');
});

test('six real paid Direct receipts without linked journal entries are all Manquants even if their fiscal evidence varies', () => {
  const amounts = [96, 195, 144, 336, 238.28, 224];
  const bookings = amounts.map((amount, i) => ({
    id: `direct-${i}`,
    ...(amount === 238.28 ? { tourist_tax_snapshot: { classification: 'unclassified', totalTaxCents: 828 } } : {}),
  }));
  const payments = amounts.map((amount, i) => ({
    id: `paid-${i}`, booking_request_id: bookings[i].id, status: 'paid',
    amount, paid_at: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
  }));
  const result = buildAccountingReconciliation(base({ bookings, payments }));
  assert.equal(result.rows.length, 6);
  assert.equal(result.accountingSummary.receiptsCents, 123328);
  assert.equal(result.accountingSummary.refundsCents, 0);
  assert.equal(result.accountingSummary.statuses.manquant, 6);
  assert.equal(result.accountingSummary.statuses.a_verifier, 0);
  assert.ok(result.rows.every(row => row.accountingStatus === 'manquant' && row.status === 'manquant'));
  assert.equal(result.rows.filter(row => row.fiscalStatus === 'coherent').length, 1);
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 123328);
});

test('missing fiscal evidence alone does not turn a genuinely linked and fully accounted receipt into Manquant', () => {
  const result = buildAccountingReconciliation(base({
    payments: [{id: 'p', booking_request_id: 'b', status: 'paid', amount: 25, paid_at: '2026-06-01T10:00:00Z'}],
    accountingEntries: [{id: 'entry', entry_kind: 'income', amount_ttc: 25,
      booking_request_id: 'b', entry_date: '2026-06-01', source_record_key: 'direct:payment:p'}],
  }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].accountingStatus, 'coherent');
  assert.equal(result.rows[0].fiscalStatus, 'a_verifier');
  assert.equal(result.rows[0].status, 'a_verifier');
});

test('zero financial refund operations do not create false cross-year tax allocation', () => {
  const booking = { id: 'cross-year-phantom', tourist_tax_snapshot: { classification: 'unclassified', totalTaxCents: 1000 } };
  const result = buildAccountingReconciliation(base({
    bookings: [booking],
    payments: [{id: 'p', booking_request_id: booking.id, status: 'paid', amount: 100,
      paid_at: '2026-06-01T10:00:00Z'}],
    refundOperations: [{id: 'zero-old', booking_request_id: booking.id, status:'succeeded',
      refunded_amount_cents:0, completed_at:'2025-01-01T10:00:00Z'}],
    accountingEntries: [{id:'e', booking_request_id:booking.id, entry_date:'2026-06-01',
      entry_kind:'income', amount_ttc:100, source_record_key:'direct:payment:p'}],
  }));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].fiscalStatus, 'coherent');
  assert.equal(result.taxSummary.totalGrossAmountCents, 9000);
});
