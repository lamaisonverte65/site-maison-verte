import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountingReconciliation } from '../netlify/functions/_lib/accounting-reconciliation.js';
import { readFileSync } from 'node:fs';

const booking = {
  id: 'b-f31', contract_total: 1000, tourist_tax_amount: 20,
  tourist_tax_snapshot: { classification: 'unclassified', totalTaxCents: 2000 },
};

function payment(id, amount, type = 'deposit', date = '2026-01-10T10:00:00Z') {
  return { id, booking_request_id: booking.id, payment_type: type,
    amount, status: 'paid', paid_at: date, created_at: date };
}
function accounting(payments) {
  return payments.map((p) => ({
    id: `entry-${p.id}`, source: 'manual', entry_kind: 'income',
    entry_date: p.paid_at.slice(0, 10), amount_ttc: p.amount,
    source_record_key: `direct:payment:${p.id}`, booking_request_id: booking.id,
  }));
}
function reconcile(payments, customBooking = booking) {
  return buildAccountingReconciliation({ year: 2026,
    bookings: [customBooking], payments, accountingEntries: accounting(payments),
    refundOperations: [], stripeBalanceTransactions: [], externalFinancials: [],
    invoices: [], creditNotes: [], cleaningIssues: [], additionalCharges: [],
  });
}

test('F3.1: un acompte de 300 € ne permet pas de déduire immédiatement les 20 € de taxe du séjour', () => {
  const result = reconcile([payment('deposit', 300)]);
  const row = result.rows[0];
  assert.equal(row.grossKnownCents, 30000, 'l’encaissement réel reste visible');
  assert.equal(row.accountingStatus, 'coherent');
  assert.equal(row.fiscalStatus, 'a_verifier');
  assert.equal(row.fiscalGrossAmountCents, null);
  assert.equal(row.touristTaxCents, null);
  assert.ok(row.reasons.includes('direct_payments_do_not_cover_contract_total'));
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 30000);
});

test('F3.1: plusieurs acomptes incomplets de la même année restent une seule somme fiscale à vérifier', () => {
  const result = reconcile([
    payment('deposit-a', 300),
    payment('deposit-b', 200, 'balance', '2026-03-02T12:00:00Z'),
  ]);
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every((row) => row.fiscalStatus === 'a_verifier'));
  assert.equal(result.taxSummary.totalGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 50000);
  assert.equal(result.taxSummary.pendingRows, 1, 'pas de double comptage du groupe séjour');
});

test('F3.1: acompte et solde intégralement réglés dans le même exercice restent qualifiés', () => {
  const result = reconcile([
    payment('deposit', 300),
    payment('balance', 700, 'balance', '2026-03-02T12:00:00Z'),
  ]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.taxSummary.totalGrossAmountCents, 98000);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 0);
  assert.equal(result.taxSummary.pendingRows, 0);
  assert.equal(result.rows.filter((row) => row.fiscalGrossAmountCents !== 0).length, 1);
  assert.equal(result.rows.reduce((sum, row) => sum + (row.touristTaxCents || 0), 0), 2000);
});

test('F3.1: paiement intégral, taxe connue, traitement fiscal inchangé', () => {
  const result = reconcile([payment('full', 1000, 'full')]);
  assert.equal(result.rows[0].fiscalStatus, 'coherent');
  assert.equal(result.rows[0].fiscalGrossAmountCents, 98000);
});

test('F3.1: un paiement étiqueté intégral mais inférieur au contrat ne certifie pas la taxe', () => {
  const result = reconcile([payment('incomplete-full', 800, 'full')]);
  assert.equal(result.rows[0].fiscalStatus, 'a_verifier');
  assert.equal(result.rows[0].fiscalGrossAmountCents, null);
  assert.equal(result.taxSummary.pendingKnownGrossAmountCents, 80000);
});

test('F3.1: paiement excédentaire et contrat historique absent ne produisent pas de brut fiscal inventé', () => {
  const excessive = reconcile([payment('too-much', 1050, 'full')]);
  assert.equal(excessive.rows[0].fiscalStatus, 'a_verifier');
  assert.ok(excessive.rows[0].reasons.includes('direct_payments_do_not_cover_contract_total'));
  const legacy = reconcile([payment('legacy', 1000, 'full')], { ...booking, contract_total: null });
  assert.equal(legacy.rows[0].fiscalStatus, 'a_verifier');
  assert.ok(legacy.rows[0].reasons.includes('direct_contract_total_missing_for_fiscal_allocation'));
});

test('F3.1: l’endpoint annuel doit lire contract_total depuis la réservation', () => {
  const source = readFileSync(new URL('../netlify/functions/admin-accounting-reconciliation.js', import.meta.url), 'utf8');
  assert.match(source, /const BOOKING_FIELDS\s*=\s*"[^"]*contract_total[^"]*"/);
});
