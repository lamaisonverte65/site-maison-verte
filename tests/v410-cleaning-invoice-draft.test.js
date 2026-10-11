import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCleaningInvoiceDraft } from '../netlify/functions/_lib/cleaning-invoice-draft.js';

const endpoint = fs.readFileSync('netlify/functions/create-cleaning-invoice-draft.js', 'utf8');

const booking = {
  id:'b1', source:'website', start_date:'2026-10-01', end_date:'2026-10-04',
  guest_first_name:'Jean', guest_last_name:'Test', guest_email:'j@example.test', guest_phone:'0600000000',
  guest_address:'1 rue Test', guest_postal_code:'65000', guest_city:'Tarbes', guest_country:'France',
  adults_count:2, children_count:0,
};
const issue = { id:'i1', booking_request_id:'b1', status:'paid', amount_due:50, payment_id:'p1', notes:'Ménage insuffisant' };
const payment = { id:'p1', payment_type:'manual', manual_reason:'cleaning', amount:50, currency:'eur', status:'paid', paid_at:'2026-10-04T12:00:00Z', refunded_amount:0 };

test('cleaning invoice draft is a separate complementary invoice for the paid issue', () => {
  const draft = buildCleaningInvoiceDraft({ booking, issue, payment });
  assert.equal(draft.invoice_kind, 'post_stay_cleaning');
  assert.equal(draft.cleaning_issue_id, 'i1');
  assert.equal(draft.booking_request_id, 'b1');
  assert.equal(draft.total_amount, 50);
  assert.equal(draft.financial_snapshot.accommodation_net, 0);
  assert.equal(draft.financial_snapshot.cleaning_fee, 50);
  assert.equal(draft.financial_snapshot.tourist_tax_amount, 0);
  assert.equal(draft.payment_snapshot[0].id, 'p1');
});

test('cleaning invoice draft requires paid issue and matching payment amount', () => {
  assert.throws(() => buildCleaningInvoiceDraft({ booking, issue:{...issue,status:'confirmed'}, payment }), /cleaning_issue_not_paid/);
  assert.throws(() => buildCleaningInvoiceDraft({ booking, issue, payment:{...payment,amount:40} }), /cleaning_payment_amount_mismatch/);
});

test('cleaning invoice endpoint is owner-only and idempotent by cleaning issue', () => {
  assert.match(endpoint, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.match(endpoint, /cleaning_issue_id/);
  assert.match(endpoint, /created: false/);
  assert.match(endpoint, /buildCleaningInvoiceDraft/);
});


test('standard direct invoice lookup excludes post-stay cleaning invoices', () => {
  const source = fs.readFileSync('netlify/functions/create-direct-invoice-draft.js', 'utf8');
  const stayFilters = source.match(/\.eq\(\"invoice_kind\", \"stay\"\)/g) || [];
  assert.ok(stayFilters.length >= 2, 'existing and race lookups must both filter invoice_kind=stay');
});
