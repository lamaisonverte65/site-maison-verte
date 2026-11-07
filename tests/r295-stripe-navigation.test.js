import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { linkedStripeTransactions, stripeReconciliationState } from '../src/utils/paymentEvidence.js';
import { resolveCustomerForBooking } from '../src/utils/adminRecordLinks.js';
const source = (name) => readFile(new URL(name, import.meta.url), 'utf8');

const booking = { id: 'booking-1', customer_id: null, guest_first_name: 'OHYA', guest_last_name: 'rieko', guest_email: 'demande@example.test', start_date: '2027-07-14', amount_paid: 448.4 };
test('R29.5 : payeur tiers - Stripe est rattaché aux identifiants, jamais au nom', () => {
  const payments = [{ id:'payment-1', booking_request_id:'booking-1', status:'paid', stripe_payment_intent_id:'pi-123' }];
  const rows = [{ id:'txn-1', type:'charge', payment_intent_id:'pi-123', amount:448.4, fee:8, net:440.4, payout_id:null }];
  assert.deepEqual(linkedStripeTransactions(booking, payments, rows).map(x=>x.id), ['txn-1']);
  assert.equal(stripeReconciliationState(booking, payments, rows, false).stripeStatus, 'Net Stripe incomplet (transactions liées)');
  assert.equal(stripeReconciliationState(booking, payments, rows, true).stripeStatus, 'Net Stripe calculé');
  assert.equal(stripeReconciliationState(booking, payments, rows, false).transferStatus, 'Virement Stripe non rapproché');
});

test('R29.5 : une clé de réservation contradictoire interdit le rapprochement par intent', () => {
  const payments = [{id:'pay-1',booking_request_id:'booking-1',stripe_payment_intent_id:'pi-123'}];
  assert.equal(linkedStripeTransactions(booking, payments, [{payment_intent_id:'pi-123',booking_request_id:'booking-OTHER',type:'charge'}]).length, 0);
});

test('R29.5 : ne pas déclarer un payout viré sur simple présence de payout_id', () => {
  const payments = [{id:'pay-1',booking_request_id:'booking-1',stripe_payment_intent_id:'pi-123'}];
  const row = {payment_intent_id:'pi-123',payout_id:'po_123',reconciliation_status:'payout_en_cours',type:'charge'};
  assert.equal(stripeReconciliationState(booking,payments,[row],false).transferStatus, 'Virement Stripe en cours');
  row.reconciliation_status = 'viré';
  assert.equal(stripeReconciliationState(booking,payments,[row],false).transferStatus, 'Virement Stripe rapproché');
});

test('R29.5 : encaissement marqué payé sans trace Stripe => mode à vérifier', () => {
  const evidence = stripeReconciliationState(booking, [], [], false);
  assert.equal(evidence.hasStripeReference, false);
  assert.equal(evidence.transferStatus, 'Mode de paiement à vérifier');
});

test('R29.5 : réservation sans paiement => non payé', () => {
  assert.equal(stripeReconciliationState({...booking, amount_paid:0}, [], [], false).transferStatus, 'Non payé');
});

test('R29.5 : accès client par FK ou contact unique, jamais par le seul nom', () => {
  const customers=[{id:'client-1', first_name:'OHYA', last_name:'rieko', email:'demande@example.test'}, {id:'client-2', first_name:'OWADA', email:'payeur@example.test'}];
  assert.equal(resolveCustomerForBooking(customers,booking)?.id, 'client-1');
  assert.equal(resolveCustomerForBooking(customers,{...booking, customer_id:'client-2'})?.id, 'client-2');
  assert.equal(resolveCustomerForBooking(customers,{...booking,guest_email:null,guest_phone:null}), null);
  assert.equal(resolveCustomerForBooking([...customers,{id:'client-3',email:'demande@example.test'}],booking),null);
});

test('R29.5 : date de création distincte du début de séjour et accès aux fiches depuis paiement', async () => {
  const data=await source('../src/hooks/usePaymentData.js');
  const timeline=await source('../src/components/admin/payments/PaymentTimeline.jsx');
  const panel=await source('../src/components/admin/PaymentsPanel.jsx');
  const admin=await source('../src/pages/Admin.jsx');
  assert.match(data,/createdAt: r\.created_at \|\| null/);
  assert.match(timeline,/date=\{row\.createdAt\}/);
  assert.doesNotMatch(timeline,/row\.createdAt \|\| row\.startDate/);
  for(const route of ['onOpenCustomer','onOpenReservation','onOpenInvoices','onOpenCommunication','onOpenStripePayouts']) assert.match(panel,new RegExp(route));
  assert.match(admin,/openCustomerByBookingId/);
  assert.match(admin,/paymentFocusId/);
});

test('R29.5 : navigation réciproque clients / factures / messages', async () => {
  for(const name of ['../src/components/admin/customer/CustomerReservationsBlock.jsx','../src/components/admin/InvoicesPanel.jsx','../src/components/admin/communication/ConversationTimeline.jsx']) {
    const content=await source(name);
    assert.match(content,/onOpenPayments/);
    assert.match(content,/onOpenInvoices|onOpenReservation/);
  }
});
