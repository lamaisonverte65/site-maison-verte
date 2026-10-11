import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAdditionalChargeInvoiceDraft } from '../netlify/functions/_lib/additional-charge-invoice-draft.js';

const booking = { id:'b1', start_date:'2026-10-01', end_date:'2026-10-04', guest_first_name:'Jean', guest_last_name:'Test', guest_email:'j@example.test' };
const charge = { id:'a1', booking_request_id:'b1', status:'paid', amount:37.5, reason_label:'Dégradation', category:'damage', customer_message:'Test', payment_id:'p1' };
const payment = { id:'p1', payment_type:'manual', manual_reason:'additional_charge', amount:37.5, currency:'eur', status:'paid', paid_at:'2026-10-04T12:00:00Z' };

test('additional charge invoice is separate and carries the free reason', () => {
  const draft = buildAdditionalChargeInvoiceDraft({ booking, charge, payment });
  assert.equal(draft.invoice_kind, 'additional_charge');
  assert.equal(draft.additional_charge_id, 'a1');
  assert.equal(draft.total_amount, 37.5);
  assert.equal(draft.financial_snapshot.additional_charge_reason, 'Dégradation');
});

test('invoice UI/PDF know generic additional charge kind', () => {
  const pdf = fs.readFileSync('netlify/functions/_lib/customer-invoice-pdf.js','utf8');
  const panel = fs.readFileSync('src/components/admin/InvoicesPanel.jsx','utf8');
  assert.match(pdf, /additional_charge/);
  assert.match(pdf, /additional_charge_reason/);
  assert.match(panel, /Paiement complémentaire/);
});
