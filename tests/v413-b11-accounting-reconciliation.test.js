import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';

function baseInput(overrides = {}) {
  return {
    year: 2026,
    bookings: [],
    payments: [],
    refundOperations: [],
    stripeBalanceTransactions: [],
    externalFinancials: [],
    accountingEntries: [],
    invoices: [],
    creditNotes: [],
    cleaningIssues: [],
    additionalCharges: [],
    ...overrides,
  };
}

const directBooking = {
  id: 'b1',
  contract_total: 1000,
  tourist_tax_amount: 20,
  tourist_tax_snapshot: { classification: 'unclassified', totalTaxCents: 2000 },
};

function directPayment(overrides = {}) {
  return {
    id: 'p1', booking_request_id: 'b1', payment_type: 'full', amount: 1000,
    status: 'paid', paid_at: '2026-06-01T10:00:00Z', created_at: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

test('Direct receipts belong to the exercise of the actual paid_at date and use explicit accounting linkage', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking],
    payments: [directPayment()],
    accountingEntries: [{
      id: 'e1', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000,
      source: 'manual', source_record_key: 'direct:payment:p1', booking_request_id: 'b1',
    }],
  }));
  const row = result.rows.find((item) => item.id === 'direct-payment:p1');
  assert.ok(row);
  assert.equal(row.date, '2026-06-01');
  assert.equal(row.grossKnownCents, 100000);
  assert.equal(row.accountingStatus, 'coherent');
  assert.deepEqual(row.accountingEntryIds, ['e1']);
  assert.equal(row.fiscalGrossAmountCents, 98000);
  assert.equal(row.fiscalCategory, 'tourist_furnished_unclassified');
  assert.equal(result.taxSummary.totalGrossAmountCents, 98000);
});

test('a deposit and balance crossing two years never get an invented tourist-tax allocation', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking],
    payments: [
      directPayment({ id: 'p2025', payment_type: 'deposit', amount: 300, paid_at: '2025-12-28T10:00:00Z' }),
      directPayment({ id: 'p2026', payment_type: 'balance', amount: 700, paid_at: '2026-01-10T10:00:00Z' }),
    ],
    accountingEntries: [{ id: 'e2026', entry_date: '2026-01-10', entry_kind: 'income', amount_ttc: 700, source: 'manual', source_record_key: 'direct:payment:p2026', booking_request_id: 'b1' }],
  }));
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.id, 'direct-payment:p2026');
  assert.equal(row.fiscalGrossAmountCents, null);
  assert.equal(row.fiscalStatus, 'a_verifier');
  assert.ok(row.reasons.includes('tourist_tax_cross_year_allocation_unknown'));
});

test('successful refunds are negative financial movements at completed_at and require a credit note only when a stay invoice was issued', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking],
    refundOperations: [{ id: 'r1', booking_request_id: 'b1', status: 'succeeded', refunded_amount_cents: 10000, completed_at: '2026-07-01T09:00:00Z' }],
    invoices: [{ id: 'i1', source: 'direct', booking_request_id: 'b1', invoice_kind: 'stay', status: 'issued', total_amount: 1000 }],
  }));
  const row = result.rows.find((item) => item.id === 'direct-refund:r1');
  assert.ok(row);
  assert.equal(row.signedAmountCents, -10000);
  assert.equal(row.documentStatus, 'manquant');
  assert.equal(row.fiscalStatus, 'a_verifier');
  assert.ok(row.reasons.includes('credit_note_missing_for_issued_stay_invoice'));
});

test('one cent difference is already an accounting mismatch', () => {
  const oneCent = buildAccountingReconciliation(baseInput({
    bookings: [directBooking], payments: [directPayment()],
    accountingEntries: [{ id: 'e1', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000.01, source: 'manual', source_record_key: 'direct:payment:p1', booking_request_id: 'b1' }],
  })).rows[0];
  assert.equal(oneCent.accountingStatus, 'a_verifier');
  assert.ok(oneCent.reasons.includes('accounting_amount_mismatch'));

  const twoCents = buildAccountingReconciliation(baseInput({
    bookings: [directBooking], payments: [directPayment()],
    accountingEntries: [{ id: 'e2', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000.02, source: 'manual', source_record_key: 'direct:payment:p1', booking_request_id: 'b1' }],
  })).rows[0];
  assert.equal(twoCents.accountingStatus, 'a_verifier');
  assert.ok(twoCents.reasons.includes('accounting_amount_mismatch'));
});

test('missing accounting counterpart is Manquant and amount/date/booking matching remains only a suggestion', () => {
  const missing = buildAccountingReconciliation(baseInput({ bookings: [directBooking], payments: [directPayment()] })).rows[0];
  assert.equal(missing.accountingStatus, 'manquant');

  const suggested = buildAccountingReconciliation(baseInput({
    bookings: [directBooking], payments: [directPayment()],
    accountingEntries: [{ id: 'candidate', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000, source: 'manual', booking_request_id: 'b1' }],
  })).rows[0];
  assert.equal(suggested.accountingStatus, 'a_verifier');
  assert.deepEqual(suggested.accountingEntryIds, ['candidate']);
  assert.ok(suggested.reasons.includes('accounting_match_amount_date_booking_only'));
});

test('multiple explicit accounting candidates are never silently selected', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking], payments: [directPayment()],
    accountingEntries: [
      { id: 'e1', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000, source_record_key: 'direct:payment:p1', booking_request_id: 'b1' },
      { id: 'e2', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000, source_record_key: 'direct:payment:p1', booking_request_id: 'b1' },
    ],
  }));
  const row = result.rows[0];
  assert.equal(row.accountingStatus, 'a_verifier');
  assert.equal(row.accountingEntryIds.length, 2);
  assert.ok(row.reasons.includes('accounting_match_ambiguous'));
});

test('Booking and Airbnb rows reconcile explicit components while fiscal gross excludes only explicit tourist tax', () => {
  for (const source of ['booking', 'airbnb']) {
    const ref = source === 'booking' ? '5035284402' : 'HMABC123';
    const external = {
      id: `${source}-fin`, source, external_reference: ref, payment_date: '2026-06-15',
      traveler_total: 667.66, accommodation_amount: 626.64, cleaning_fee: 0, tourist_tax_amount: 41.02,
      commission_amount: 94, payment_fee_amount: 9.35, net_payout: 564.31,
      provenance: { fiscal_classification: 'unclassified' },
    };
    const accountingEntries = [
      { id: `${source}-income`, entry_date: '2026-06-15', entry_kind: 'income', source, external_reference: ref, amount_ttc: 667.66, source_record_key: `${source}:reservation:${ref}:gross` },
      { id: `${source}-commission`, entry_date: '2026-06-15', entry_kind: 'expense', source, external_reference: ref, amount_ttc: 94, source_record_key: `${source}:reservation:${ref}:${source === 'airbnb' ? 'service_fee' : 'commission'}` },
      { id: `${source}-fee`, entry_date: '2026-06-15', entry_kind: 'expense', source, external_reference: ref, amount_ttc: 9.35, source_record_key: `${source}:reservation:${ref}:payment_fee` },
    ];
    const result = buildAccountingReconciliation(baseInput({ externalFinancials: [external], accountingEntries }));
    const row = result.rows.find((item) => item.id === `platform:${source}:${ref}`);
    assert.equal(row.accountingStatus, 'coherent');
    assert.equal(row.fiscalGrossAmountCents, 62664);
    assert.equal(row.touristTaxCents, 4102);
    assert.equal(row.commissionCents, 9400);
    assert.equal(row.paymentFeeCents, 935);
  }
});

test('net payout plus commission never manufactures platform fiscal gross', () => {
  const result = buildAccountingReconciliation(baseInput({
    externalFinancials: [{
      id: 'f1', source: 'booking', external_reference: 'X1', payment_date: '2026-03-01',
      traveler_total: null, accommodation_amount: null, cleaning_fee: null, tourist_tax_amount: null,
      commission_amount: 50, payment_fee_amount: 5, net_payout: 445,
      provenance: { fiscal_classification: 'unclassified' },
    }],
  }));
  const row = result.rows[0];
  assert.equal(row.grossKnownCents, null);
  assert.equal(row.fiscalGrossAmountCents, null);
  assert.equal(row.fiscalStatus, 'a_verifier');
  assert.ok(row.reasons.includes('platform_fiscal_breakdown_incomplete'));
});

test('paid post-stay additional charge is a separate receipt and never alters original contract total', () => {
  const booking = { ...directBooking, contract_total: 1000 };
  const result = buildAccountingReconciliation(baseInput({
    bookings: [booking],
    payments: [directPayment({ id: 'p-extra', payment_type: 'manual', manual_reason: 'additional_charge', amount: 50 })],
    additionalCharges: [{ id: 'c1', booking_request_id: 'b1', payment_id: 'p-extra', amount: 50, status: 'paid' }],
    accountingEntries: [{ id: 'e-extra', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 50, source_record_key: 'direct:payment:p-extra', booking_request_id: 'b1' }],
  }));
  const row = result.rows.find((item) => item.id === 'direct-payment:p-extra');
  assert.equal(row.type, 'additional_charge');
  assert.equal(row.grossKnownCents, 5000);
  assert.equal(row.fiscalGrossAmountCents, 5000);
  assert.equal(booking.contract_total, 1000);
});

test('unmatched accounting expenses remain visible in management summary without polluting fiscal pending totals', () => {
  const result = buildAccountingReconciliation(baseInput({
    accountingEntries: [{ id: 'energy', entry_date: '2026-02-01', entry_kind: 'expense', amount_ttc: 120, source: 'manual', label: 'Électricité', accounting_categories: { code: 'energy', name: 'Énergie' } }],
  }));
  const row = result.rows.find((item) => item.id === 'accounting-entry:energy');
  assert.ok(row);
  assert.equal(row.type, 'expense');
  assert.equal(row.accountingCategory, 'energy');
  assert.equal(result.accountingSummary.expensesCents, 12000);
  assert.equal(result.taxSummary.pendingRows, 0);
});


test('same-year multi-payment fiscal control is booking-level and any unresolved payment keeps the whole booking pending', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking],
    payments: [
      directPayment({ id: 'p-deposit', payment_type: 'deposit', amount: 300, paid_at: '2026-01-10T10:00:00Z' }),
      directPayment({ id: 'p-balance', payment_type: 'balance', amount: 700, paid_at: '2026-02-10T10:00:00Z' }),
    ],
    accountingEntries: [{ id: 'e-balance', entry_date: '2026-02-10', entry_kind: 'income', amount_ttc: 700, source_record_key: 'direct:payment:p-balance', booking_request_id: 'b1' }],
  }));
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 100000);
  assert.equal(result.taxSummary.pendingRows, 1);
});

test('missing historical tourist-tax amount cannot become a zero fiscal deduction', () => {
  const booking = { ...directBooking, tourist_tax_amount: null, tourist_tax_snapshot: { classification: 'unclassified' } };
  const result = buildAccountingReconciliation(baseInput({
    bookings: [booking],
    payments: [directPayment()],
    accountingEntries: [{ id: 'e1', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000, source_record_key: 'direct:payment:p1', booking_request_id: 'b1' }],
  }));
  const row = result.rows[0];
  assert.equal(row.fiscalGrossAmountCents, null);
  assert.equal(row.fiscalStatus, 'a_verifier');
  assert.ok(row.reasons.includes('tourist_tax_snapshot_missing'));
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 100000);
});


test('a post-stay charge in another year does not turn the original stay receipts into a cross-year tourist-tax allocation', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking],
    payments: [
      directPayment({ id: 'stay-2026', amount: 1000, paid_at: '2026-06-01T10:00:00Z' }),
      directPayment({ id: 'extra-2027', payment_type: 'manual', manual_reason: 'additional_charge', amount: 50, paid_at: '2027-01-05T10:00:00Z' }),
    ],
    additionalCharges: [{ id: 'c2027', booking_request_id: 'b1', payment_id: 'extra-2027', amount: 50, status: 'paid' }],
    accountingEntries: [{ id: 'e-stay', entry_date: '2026-06-01', entry_kind: 'income', amount_ttc: 1000, source_record_key: 'direct:payment:stay-2026', booking_request_id: 'b1' }],
  }));
  const stay = result.rows.find((row) => row.id === 'direct-payment:stay-2026');
  assert.equal(stay.fiscalStatus, 'coherent');
  assert.equal(stay.fiscalGrossAmountCents, 98000);
  assert.ok(!stay.reasons.includes('tourist_tax_cross_year_allocation_unknown'));
});


test('an explicit accounting identifier cannot hide an entry posted in the wrong exercise', () => {
  const result = buildAccountingReconciliation(baseInput({
    bookings: [directBooking],
    payments: [directPayment()],
    accountingEntries: [{ id: 'e-wrong-year', entry_date: '2025-12-31', entry_kind: 'income', amount_ttc: 1000, source_record_key: 'direct:payment:p1', booking_request_id: 'b1' }],
  }));
  const row = result.rows.find((item) => item.id === 'direct-payment:p1');
  assert.equal(row.accountingStatus, 'a_verifier');
  assert.ok(row.reasons.includes('accounting_entry_year_mismatch'));
});
