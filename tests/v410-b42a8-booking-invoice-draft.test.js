import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBookingInvoiceDraft } from '../netlify/functions/_lib/booking-invoice-draft.js';
import { invoicePdfModel } from '../netlify/functions/_lib/customer-invoice-pdf.js';
const booking={id:'fa7f8d2b-a7f0-451e-bf66-9a291720dd69',source:'booking_import',guest_first_name:'Anne',guest_last_name:'Le Noach',guest_phone:'+33645537332',start_date:'2026-08-15',end_date:'2026-08-23',adults_count:2};
const financial={source:'booking',external_reference:'5035284402',booking_request_id:booking.id,currency:'eur',start_date:'2026-08-15',end_date:'2026-08-23',nights:8,accommodation_amount:626.64,cleaning_fee:0,tourist_tax_amount:41.02,traveler_total:667.66,commission_amount:94,payment_fee_amount:9.35,net_payout:564.31,payment_date:'2026-08-27',payment_reference:'X2LBzHB7HCvznxuM',provenance:{accommodation_amount:'derived:booking_overview:final_amount'},raw_snapshot:{booking_statement:{payment_status:'by_booking'}}};
test('B4.2a-8 construit le candidat Anne sans commission dans le total voyageur',()=>{const d=buildBookingInvoiceDraft({booking,financial});assert.equal(d.source,'booking');assert.equal(d.external_reference,'5035284402');assert.equal(d.total_amount,667.66);assert.equal(d.financial_snapshot.accommodation_net,626.64);assert.equal(d.financial_snapshot.cleaning_fee,0);assert.equal(d.financial_snapshot.tourist_tax_amount,41.02);assert.equal(d.financial_snapshot.platform_commission,94);assert.equal(d.financial_snapshot.platform_payment_fee,9.35);assert.equal(d.payment_snapshot[0].amount,667.66);assert.equal(d.payment_snapshot[0].payment_type,'booking_platform');});
test('B4.2a-8 refuse une décomposition incomplète',()=>assert.throws(()=>buildBookingInvoiceDraft({booking,financial:{...financial,tourist_tax_amount:null}}),/booking_financial_breakdown_incomplete/));
test('B4.2a-8 refuse un total incohérent',()=>assert.throws(()=>buildBookingInvoiceDraft({booking,financial:{...financial,traveler_total:667.65}}),/booking_financial_breakdown_mismatch/));
test('B4.2a-8 endpoint reste owner-only et lit le registre financier',()=>{const s=fs.readFileSync(new URL('../netlify/functions/create-booking-invoice-draft.js',import.meta.url),'utf8');assert.match(s,/ownerOnly:\s*true/);assert.match(s,/external_reservation_financials/);assert.doesNotMatch(s,/admin_issue_customer_invoice/);});
test('B4.2a-8 PDF sait libeller le paiement Booking',()=>{const s=fs.readFileSync(new URL('../netlify/functions/_lib/customer-invoice-pdf.js',import.meta.url),'utf8');assert.match(s,/booking_platform: 'Paiement via Booking\.com'/);});

test('B4.2a-9 affiche le détail Booking et ne verrouille que si le nom/prénom manquent',()=>{
  const s=fs.readFileSync(new URL('../src/components/admin/InvoicesPanel.jsx',import.meta.url),'utf8');
  assert.match(s,/Détail de la facture Booking/);
  assert.match(s,/Référence Booking/);
  assert.match(s,/Hébergement/);
  assert.match(s,/Taxe de séjour/);
  assert.match(s,/Identité client à compléter avant émission/);
  assert.match(s,/REQUIRED_CUSTOMER_FIELDS/);
  assert.match(s,/OPTIONAL_BILLING_FIELDS/);
  assert.match(s,/elles ne verrouillent pas l’émission pour ce client particulier/);
  const requiredBlock=s.match(/const REQUIRED_CUSTOMER_FIELDS = \[([\s\S]*?)\];/)?.[1] || '';
  assert.match(requiredBlock,/first_name/);
  assert.match(requiredBlock,/last_name/);
  assert.doesNotMatch(requiredBlock,/address|postal_code|city|country/);
});
test('B4.2a-9 garde commission, frais et net Booking dans une zone interne',()=>{
  const s=fs.readFileSync(new URL('../src/components/admin/InvoicesPanel.jsx',import.meta.url),'utf8');
  assert.ok(s.includes("Informations plateforme (internes, non imprimées sur la facture)"));
  assert.match(s,/platform_commission/);
  assert.match(s,/platform_payment_fee/);
  assert.match(s,/platform_net_payout/);
});
test('B4.2a-9 PDF affiche référence Booking, ménage zéro et paiement plateforme sans fausse date',()=>{
  const src=fs.readFileSync(new URL('../netlify/functions/_lib/customer-invoice-pdf.js',import.meta.url),'utf8');
  assert.match(src,/Référence Booking/);
  assert.ok(src.includes("invoice.source === 'booking'"));
  assert.ok(src.includes("const paidDate = p.paid_at ?"));
});

test('B4.2a-9 modèle PDF Booking contient le détail client sans commission plateforme',()=>{
  const draft=buildBookingInvoiceDraft({booking:{...booking,guest_address:'12 rue Test',guest_postal_code:'65000',guest_city:'Tarbes',guest_country:'France'},financial});
  const issued={...draft,status:'issued',invoice_number:'LMV-2026-9999',issued_at:'2026-10-02T12:00:00Z'};
  const model=invoicePdfModel(issued);
  const text=model.lines.map((line)=>line.t).join('\n');
  assert.match(text,/Référence Booking : 5035284402/);
  assert.match(text,/Hébergement/);
  assert.match(text,/626,64 €/);
  assert.match(text,/Ménage/);
  assert.match(text,/0,00 €/);
  assert.match(text,/Taxe de séjour/);
  assert.match(text,/41,02 €/);
  assert.match(text,/Paiement via Booking\.com/);
  assert.match(text,/667,66 €/);
  assert.doesNotMatch(text,/Commission Booking|94,00 €|9,35 €|564,31 €/);
  assert.equal(model.remaining,0);
});
test('B4.2a-10 interface propose un aperçu PDF séparé de l’émission',()=>{const s=fs.readFileSync(new URL('../src/components/admin/InvoicesPanel.jsx',import.meta.url),'utf8');assert.match(s,/Aperçu PDF/);assert.match(s,/openInvoicePreviewPdf/);});

test('B4.2a-11b brouillon propose un champ entreprise facultatif',()=>{
  const s=fs.readFileSync(new URL('../src/components/admin/InvoicesPanel.jsx',import.meta.url),'utf8');
  assert.match(s,/company_name/);
  assert.match(s,/Entreprise \/ raison sociale/);
});
