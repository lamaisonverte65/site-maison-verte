import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDirectInvoiceDraft } from '../netlify/functions/_lib/direct-invoice-draft.js';

const migration = fs.readFileSync('supabase/migrations/202610010004_v410_direct_invoice_draft_guard.sql', 'utf8');
const endpoint = fs.readFileSync('netlify/functions/create-direct-invoice-draft.js', 'utf8');

const booking = {
  id:'11111111-1111-1111-1111-111111111111', source:'website', start_date:'2026-10-10', end_date:'2026-10-13',
  guest_first_name:'Jean', guest_last_name:'Test', guest_email:'j@example.test', guest_phone:'0600000000',
  guest_address:'1 rue Test', guest_postal_code:'65000', guest_city:'Tarbes', guest_country:'France',
  adults_count:2, children_count:1, children_ages:[12], accommodation_gross:330, promotion_discount_rate:10,
  promotion_discount_amount:33, accommodation_net:297, cleaning_fee:50, tourist_tax_amount:18,
  tourist_tax_collected:18, tourist_tax_refunded:0, tourist_tax_collector:'la_maison_verte',
  tourist_tax_snapshot:{classification:'unclassified'}, deposit_rate:0.3, deposit_basis:347, deposit_amount:104.1, contract_total:365,
};

test('B2 construit le brouillon depuis les snapshots contractuels sans recalculer le total', () => {
  const draft = buildDirectInvoiceDraft({ booking, payments:[] });
  assert.equal(draft.total_amount, 365);
  assert.equal(draft.financial_snapshot.contract_total, 365);
  assert.equal(draft.financial_snapshot.accommodation_net, 297);
  assert.equal(draft.status, 'draft');
});

test('B2 fige identité exploitant et adresse distincte du logement', () => {
  const draft = buildDirectInvoiceDraft({ booking, payments:[] });
  assert.equal(draft.seller_snapshot.address, '4 Chemin du Calvaire');
  assert.equal(draft.seller_snapshot.accommodation_address, '3 Impasse Trassens');
  assert.equal(draft.seller_snapshot.siret, '42228411700039');
});

test('B2 utilise les vrais champs voyageurs', () => {
  const draft = buildDirectInvoiceDraft({ booking, payments:[] });
  assert.deepEqual(draft.stay_snapshot.children_ages, [12]);
  assert.equal(draft.stay_snapshot.adults_count, 2);
  assert.equal(draft.stay_snapshot.children_count, 1);
  assert.equal(draft.stay_snapshot.nights, 3);
});

test('B2 snapshotte les paiements réellement liés et leurs remboursements', () => {
  const draft = buildDirectInvoiceDraft({ booking, payments:[
    { id:'p2', booking_request_id:booking.id, payment_type:'balance', amount:260.9, currency:'eur', status:'paid', paid_at:'2026-10-02', refunded_amount:10, refunded_at:'2026-10-05' },
    { id:'other', booking_request_id:'other', amount:999, currency:'eur' },
    { id:'p1', booking_request_id:booking.id, payment_type:'deposit', amount:104.1, currency:'eur', status:'paid', paid_at:'2026-09-01', refunded_amount:0 },
  ]});
  assert.equal(draft.payment_snapshot.length, 2);
  assert.equal(draft.payment_snapshot[0].id, 'p1');
  assert.equal(draft.payment_snapshot[1].refunded_amount, 10);
});

test('B2 refuse un ancien Direct sans snapshot V4.10 complet', () => {
  assert.throws(() => buildDirectInvoiceDraft({ booking:{...booking, contract_total:null}, payments:[] }), /v410_snapshot_incomplete:contract_total/);
});

test('B2 refuse les sources plateforme et personnelles', () => {
  assert.throws(() => buildDirectInvoiceDraft({ booking:{...booking, source:'booking_import'}, payments:[] }), /direct_booking_required/);
  assert.throws(() => buildDirectInvoiceDraft({ booking:{...booking, source:'admin_personal'}, payments:[] }), /direct_booking_required/);
});

test('B2 rend la création idempotente et owner-only côté serveur', () => {
  assert.match(endpoint, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.match(endpoint, /\.eq\("source", "direct"\)/);
  assert.match(endpoint, /created: false/);
  assert.doesNotMatch(endpoint, /admin_issue_customer_invoice/);
});

test('B2 garantit une facture Direct unique par réservation sans toucher à la numérotation', () => {
  assert.match(migration, /create unique index customer_invoices_direct_booking_unique_idx/i);
  assert.match(migration, /where source = 'direct' and booking_request_id is not null/i);
  assert.doesNotMatch(migration, /customer_invoice_counters|invoice_number|admin_issue_customer_invoice/i);
});
