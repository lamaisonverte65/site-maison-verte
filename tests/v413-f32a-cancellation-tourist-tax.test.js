import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';
import { explainReconciliationReasons } from '../src/utils/accountingReconciliationView.js';

const baseBooking = {
  id: 'f32a-booking', status: 'accepted', contract_total: 1000,
  tourist_tax_amount: 20,
  tourist_tax_snapshot: { classification: 'unclassified', totalTaxCents: 2000 },
};

function payment(id, amount, date = '2026-06-01T12:00:00Z') {
  return { id, booking_request_id: baseBooking.id, status: 'paid',
    payment_type: 'manual', amount, paid_at: date, created_at: date };
}

function reconcile({ status = 'accepted', payments = [payment('paid', 1000)], refundOperations = [] } = {}) {
  return buildAccountingReconciliation({
    year: 2026,
    bookings: [{ ...baseBooking, status }], payments, refundOperations,
    accountingEntries: payments.map(p => ({
      id: `entry-${p.id}`, booking_request_id: baseBooking.id, entry_kind: 'income',
      source: 'manual', amount_ttc: p.amount, entry_date: p.paid_at.slice(0, 10),
      source_record_key: `direct:payment:${p.id}`,
    })),
    stripeBalanceTransactions: [], externalFinancials: [], invoices: [], creditNotes: [],
    cleaningIssues: [], additionalCharges: [], refundAllocations: [],
  });
}

const reason = 'direct_cancelled_booking_fiscal_qualification_required';

test('F3.2a: reservation annulee et totalement payee sans remboursement : taxe non deduite', () => {
  const result = reconcile({
    status: 'cancelled',
    refundOperations: [{ id: 'zero-cancel', booking_request_id: baseBooking.id,
      status: 'succeeded', action: 'cancel_refund', refunded_amount_cents: 0,
      completed_at: '2026-06-02T12:00:00Z' }],
  });
  assert.equal(result.rows.length, 1, 'pas de fausse ligne de remboursement a 0 euro');
  const row = result.rows[0];
  assert.equal(row.grossKnownCents, 100000);
  assert.equal(row.accountingStatus, 'coherent', 'le rapprochement comptable est preserve');
  assert.equal(row.fiscalStatus, 'a_verifier');
  assert.equal(row.fiscalGrossAmountCents, null);
  assert.equal(row.touristTaxCents, null);
  assert.ok(row.reasons.includes(reason));
  assert.equal(result.accountingSummary.receiptsCents, 100000);
  assert.equal(result.accountingSummary.refundsCents, 0);
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 100000);
  assert.equal(result.taxSummary.pendingRows, 1);
});

test('F3.2a: accompte conserve apres annulation reste visible et motive un controle', () => {
  const result = reconcile({ status: 'cancelled', payments: [payment('deposit', 300)] });
  const row = result.rows[0];
  assert.equal(row.grossKnownCents, 30000);
  assert.equal(row.accountingStatus, 'coherent');
  assert.equal(row.fiscalGrossAmountCents, null);
  assert.equal(row.touristTaxCents, null);
  assert.ok(row.reasons.includes(reason));
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 30000);
});

test('F3.2a: acompte + solde avant annulation : une seule somme fiscale en attente', () => {
  const result = reconcile({ status: 'cancelled', payments: [
    payment('deposit', 300), payment('balance', 700, '2026-06-05T12:00:00Z'),
  ] });
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every(r => r.fiscalStatus === 'a_verifier' && r.touristTaxCents === null));
  assert.ok(result.rows.every(r => r.reasons.includes(reason)));
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 100000);
  assert.equal(result.taxSummary.pendingRows, 1, 'regroupement sans double comptabilisation');
});

test('F3.2a: annulation et remboursement positif ne perdent pas le motif fiscal du remboursement', () => {
  const result = reconcile({ status: 'cancelled', refundOperations: [{
    id: 'refund', booking_request_id: baseBooking.id, status: 'succeeded',
    refunded_amount_cents: 40000, completed_at: '2026-06-02T12:00:00Z',
  }] });
  const receipt = result.rows.find(r => r.type === 'receipt');
  const refund = result.rows.find(r => r.type === 'refund');
  assert.ok(receipt.reasons.includes(reason));
  assert.ok(receipt.reasons.includes('refund_fiscal_effect_requires_versioned_rule'));
  assert.equal(receipt.fiscalGrossAmountCents, null);
  assert.equal(receipt.touristTaxCents, null);
  assert.equal(refund.signedAmountCents, -40000);
  assert.equal(result.accountingSummary.refundsCents, 40000);
});

test('F3.2a: sejour accepte et paye conserve la ventilation deja validee', () => {
  const result = reconcile();
  assert.equal(result.rows[0].fiscalStatus, 'coherent');
  assert.equal(result.rows[0].fiscalGrossAmountCents, 98000);
  assert.equal(result.rows[0].touristTaxCents, 2000);
  assert.equal(result.taxSummary.totalGrossAmountCents, 98000);
  assert.ok(!result.rows[0].reasons.includes(reason));
});

test('F3.2a: endpoint charge le statut de reservation depuis Supabase', () => {
  const source = readFileSync(new URL('../netlify/functions/admin-accounting-reconciliation.js', import.meta.url), 'utf8');
  assert.match(source, /const BOOKING_FIELDS\s*=\s*"[^\"]*status[^\"]*"/);
});

test('F3.2a: interface explique clairement le controle de la taxe apres annulation', () => {
  const reasons = explainReconciliationReasons([reason]);
  assert.equal(reasons.length, 1);
  assert.doesNotMatch(reasons[0].label, /Motif non traduit/);
  assert.match(reasons[0].label, /annul/i);
  assert.match(reasons[0].description, /taxe de s[ée]jour/i);
});
