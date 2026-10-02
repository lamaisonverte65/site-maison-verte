import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildLegacyDirectInvoiceDraft } from '../netlify/functions/_lib/direct-invoice-draft.js';
const endpoint=fs.readFileSync('netlify/functions/create-direct-invoice-draft.js','utf8');
const ui=fs.readFileSync('src/components/admin/InvoicesPanel.jsx','utf8');
const service=fs.readFileSync('src/services/invoiceService.js','utf8');
const migration=fs.readFileSync('supabase/migrations/202610010006_v410_legacy_direct_invoice_guard.sql','utf8');
const booking={id:'b1',source:'website',start_date:'2025-07-01',end_date:'2025-07-05',guest_first_name:'Jean',guest_last_name:'Ancien',owner_price:400,deposit_amount:120};

test('B4.1 legacy draft preserves known historical total but invents no breakdown',()=>{const d=buildLegacyDirectInvoiceDraft({booking,payments:[]});assert.equal(d.total_amount,400);assert.equal(d.financial_snapshot.legacy_reference_total,400);assert.equal(d.financial_snapshot.accommodation_net,null);assert.equal(d.financial_snapshot.cleaning_fee,null);assert.equal(d.financial_snapshot.tourist_tax_amount,null);assert.equal(d.financial_snapshot.invoice_ready,false);});
test('B4.1 legacy draft snapshots real linked payments',()=>{const d=buildLegacyDirectInvoiceDraft({booking,payments:[{id:'p',booking_request_id:'b1',amount:120,currency:'eur',status:'paid'}]});assert.equal(d.payment_snapshot.length,1);assert.equal(d.payment_snapshot[0].amount,120);});
test('B4.1 refuses historical draft without any known reservation total',()=>{assert.throws(()=>buildLegacyDirectInvoiceDraft({booking:{...booking,owner_price:null,estimated_total:null,gross_amount:null}}),/legacy_total_missing/);});
test('B4.1 endpoint falls back to legacy only when V4.10 snapshot is incomplete',()=>{assert.match(endpoint,/message\.startsWith\("v410_snapshot_incomplete:"\)/);assert.match(endpoint,/buildLegacyDirectInvoiceDraft/);});
test('B4.1 UI exposes explicit manual historical breakdown',()=>{assert.match(ui,/Réservation Direct historique/);assert.match(ui,/Hébergement net/);assert.match(ui,/Taxe de séjour/);assert.match(ui,/Aucune valeur manquante n’est inventée/);});
test('B4.1 service requires breakdown to equal known historical total',()=>{assert.match(service,/Math\.abs\(computed - referenceTotal\)/);assert.match(service,/invoice_ready: true/);});
test('B4.1 issue button stays disabled until historical breakdown is ready',()=>{assert.match(ui,/invoice_ready !== true/);assert.match(ui,/Émission verrouillée/);assert.match(ui,/not-allowed/);assert.match(ui,/Valide d’abord le détail financier/);});
test('B4.1 SQL guard blocks incomplete or mismatched historical issue before numbering',()=>{assert.match(migration,/legacy_invoice_not_ready/);assert.match(migration,/legacy_invoice_total_mismatch/);assert.ok(migration.indexOf('legacy_invoice_not_ready') < migration.indexOf('customer_invoice_counters'));});

test('B4.1b reconstructs 82090B28 as 480 EUR accommodation only from historical Toussaint tariff', async()=>{
  const { buildReconstructedLegacyDirectInvoiceDraft } = await import('../netlify/functions/_lib/direct-invoice-draft.js');
  const realBooking={id:'82090b28-a1c3-4bc2-94fa-f57779cd1259',source:'website',created_at:'2026-09-14T21:39:10.02224Z',start_date:'2026-10-18',end_date:'2026-10-24',guest_first_name:'Don-Linda',guest_last_name:'Lunjevich',owner_price:480,estimated_total:480,deposit_amount:144};
  const seasons=[{start_date:'2026-10-17',end_date:'2026-11-02',night_price:80,is_active:true,created_at:'2026-05-20T09:42:18.457925Z',updated_at:'2026-05-21T12:10:33.197Z'}];
  const d=buildReconstructedLegacyDirectInvoiceDraft({booking:realBooking,payments:[],seasons,overrides:[]});
  assert.ok(d); assert.equal(d.total_amount,480); assert.equal(d.financial_snapshot.accommodation_gross,480); assert.equal(d.financial_snapshot.accommodation_net,480); assert.equal(d.financial_snapshot.cleaning_fee,0); assert.equal(d.financial_snapshot.tourist_tax_amount,0); assert.equal(d.financial_snapshot.invoice_ready,true); assert.equal(d.financial_snapshot.reconstruction.method,'historical_tariff_match'); assert.equal(d.financial_snapshot.reconstruction.nightly.length,6);
});

test('B4.1b refuses automatic reconstruction when tariff does not exactly match known total', async()=>{
  const { buildReconstructedLegacyDirectInvoiceDraft } = await import('../netlify/functions/_lib/direct-invoice-draft.js');
  const b={...booking,created_at:'2026-09-14T21:39:10Z',start_date:'2026-10-18',end_date:'2026-10-24',owner_price:470};
  const seasons=[{start_date:'2026-10-17',end_date:'2026-11-02',night_price:80,is_active:true,created_at:'2026-05-20T09:42:18Z',updated_at:'2026-05-21T12:10:33Z'}];
  assert.equal(buildReconstructedLegacyDirectInvoiceDraft({booking:b,seasons,overrides:[]}),null);
});

test('B4.1b refuses a tariff row modified after the booking', async()=>{
  const { buildReconstructedLegacyDirectInvoiceDraft } = await import('../netlify/functions/_lib/direct-invoice-draft.js');
  const b={...booking,created_at:'2026-09-14T21:39:10Z',start_date:'2026-10-18',end_date:'2026-10-24',owner_price:480};
  const seasons=[{start_date:'2026-10-17',end_date:'2026-11-02',night_price:80,is_active:true,created_at:'2026-05-20T09:42:18Z',updated_at:'2026-09-20T12:10:33Z'}];
  assert.equal(buildReconstructedLegacyDirectInvoiceDraft({booking:b,seasons,overrides:[]}),null);
});

test('B4.1b keeps post-cleaning-feature legacy bookings manual', async()=>{
  const { buildReconstructedLegacyDirectInvoiceDraft } = await import('../netlify/functions/_lib/direct-invoice-draft.js');
  const b={...booking,created_at:'2026-09-25T10:00:00Z',start_date:'2026-10-18',end_date:'2026-10-24',owner_price:480};
  const seasons=[{start_date:'2026-10-17',end_date:'2026-11-02',night_price:80,is_active:true,created_at:'2026-05-20T09:42:18Z',updated_at:'2026-05-21T12:10:33Z'}];
  assert.equal(buildReconstructedLegacyDirectInvoiceDraft({booking:b,seasons,overrides:[]}),null);
});

test('B4.1b endpoint can upgrade an existing incomplete legacy draft without issuing it',()=>{assert.match(endpoint,/existing\?\.status === "issued"/);assert.match(endpoint,/buildReconstructedLegacyDirectInvoiceDraft/);assert.match(endpoint,/existingNotReady/);assert.match(endpoint,/reconstructed: true/);assert.doesNotMatch(endpoint,/admin_issue_customer_invoice/);});
test('B4.1b UI offers conservative automatic reconstruction and keeps manual fallback',()=>{assert.match(ui,/Tenter la reconstruction automatique/);assert.match(ui,/Reconstruction automatique non démontrable/);assert.match(ui,/historical_tariff_match/);assert.match(ui,/Valider le détail financier/);});
