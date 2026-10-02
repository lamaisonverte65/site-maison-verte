import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCustomerInvoicePdf, invoicePdfModel } from '../netlify/functions/_lib/customer-invoice-pdf.js';
const invoice = { status:'issued', invoice_number:'LMV-2026-0001', issued_at:'2026-10-01T10:00:00Z', total_amount:650, seller_snapshot:{legal_name:'Raphaël BENOIT',trade_name:'La Maison Verte',address:'4 Chemin du Calvaire',postal_code:'65240',city:'Arreau',country:'France',siret:'42228411700039',vat_legal_basis:'CGI art. 261 D, 4°'}, customer_snapshot:{first_name:'Jean',last_name:'Test',address:'1 rue Exemple',postal_code:'31000',city:'Toulouse',country:'France'}, stay_snapshot:{start_date:'2026-10-10',end_date:'2026-10-16',nights:6,adults_count:2,children_count:1,accommodation_name:'La Maison Verte',accommodation_address:'3 Impasse Trassens',accommodation_postal_code:'65240',accommodation_city:'Arreau'}, financial_snapshot:{accommodation_gross:600,promotion_discount_amount:0,accommodation_net:600,cleaning_fee:50,tourist_tax_amount:0}, payment_snapshot:[{payment_type:'deposit',amount:195,currency:'eur',status:'paid',paid_at:'2026-09-01T10:00:00Z',refunded_amount:0}] };
test('B3 refuse un PDF pour un brouillon',()=>assert.throws(()=>buildCustomerInvoicePdf({...invoice,status:'draft'}),/issued_invoice_required/));
test('B3 génère un vrai flux PDF',()=>{const pdf=buildCustomerInvoicePdf(invoice);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1000);assert.match(pdf.toString('latin1'),/LMV-2026-0001/);});
test('B3 calcule payé et reste depuis le snapshot paiements',()=>{const m=invoicePdfModel(invoice);assert.equal(m.paid,195);assert.equal(m.remaining,455);});
test('B3 utilise les deux adresses distinctes',()=>{const s=buildCustomerInvoicePdf(invoice).toString('latin1');assert.match(s,/4 Chemin du Calvaire/);assert.match(s,/3 Impasse Trassens/);});
test('B3 imprime la base légale TVA du snapshot',()=>assert.match(buildCustomerInvoicePdf(invoice).toString('latin1'),/261 D, 4°/));
test('B3 archive uniquement après émission et sans réécrire le PDF',()=>{const s=fs.readFileSync(new URL('../netlify/functions/archive-customer-invoice-pdf.js',import.meta.url),'utf8');assert.match(s,/status !== 'issued'/);assert.match(s,/pdf_storage_path/);assert.match(s,/upsert: false/);assert.doesNotMatch(s,/admin_issue_customer_invoice/);});
test('B3 téléchargement PDF reste owner-only',()=>{const s=fs.readFileSync(new URL('../netlify/functions/get-customer-invoice-pdf.js',import.meta.url),'utf8');assert.match(s,/ownerOnly: true/);assert.match(s,/private, no-store/);});
test('B3 crée un bucket privé PDF uniquement',()=>{const s=fs.readFileSync(new URL('../supabase/migrations/202610010005_v410_customer_invoice_pdf_storage.sql',import.meta.url),'utf8');assert.match(s,/customer-invoices/);assert.match(s,/false/);assert.match(s,/application\/pdf/);});
test('B4.2a-10 aperçu PDF accepte un brouillon sans numéro et le marque non émis',()=>{const draft={...invoice,status:'draft',invoice_number:null,issued_at:null};const pdf=buildCustomerInvoicePdf(draft,{preview:true});const s=pdf.toString('latin1');assert.match(s,/APERÇU - BROUILLON DE FACTURE/);assert.match(s,/Document non émis - sans numéro de facture/);assert.doesNotMatch(s,/FACTURE N°/);});
test('B4.2a-10 aperçu refuse une facture déjà émise',()=>assert.throws(()=>buildCustomerInvoicePdf(invoice,{preview:true}),/draft_invoice_required/));
test('B4.2a-10 endpoint aperçu est owner-only, sans archivage ni émission',()=>{const s=fs.readFileSync(new URL('../netlify/functions/preview-customer-invoice-pdf.js',import.meta.url),'utf8');assert.match(s,/ownerOnly: true/);assert.match(s,/status !== 'draft'/);assert.match(s,/preview: true/);assert.match(s,/private, no-store/);assert.doesNotMatch(s,/storage\.from|admin_issue_customer_invoice|invoice_number\s*=/);});
test('B4.2a-11 PDF Booking évite le doublon hébergement net et affiche les frais plateforme séparément',()=>{const booking={...invoice,source:'booking',external_reference:'5035284402',total_amount:667.66,financial_snapshot:{accommodation_gross:626.64,accommodation_net:626.64,cleaning_fee:0,tourist_tax_amount:41.02,platform_commission:94,platform_payment_fee:9.35,platform_net_payout:564.31},payment_snapshot:[{payment_type:'booking_platform',amount:667.66,status:'paid',refunded_amount:0}]};const s=buildCustomerInvoicePdf(booking,{preview:false}).toString('latin1');assert.match(s,/Hébergement/);assert.doesNotMatch(s,/Hébergement net/);assert.match(s,/Commission et frais Booking.com supportés par La Maison Verte : 103,35 \x80/);assert.match(s,/Ces frais ne s'ajoutent pas au montant de la facture client/);assert.doesNotMatch(s,/564,31/);assert.match(s,/Montant réglé/);assert.doesNotMatch(s,/Montant net réglé/);});

test('B4.2a-11b PDF place émetteur et client sur deux colonnes et imprime entreprise si renseignée',()=>{
  const withCompany={...invoice,customer_snapshot:{...invoice.customer_snapshot,company_name:'Société Exemple'}};
  const model=invoicePdfModel(withCompany);
  const emitter=model.lines.find((l)=>l.t==='ÉMETTEUR');
  const client=model.lines.find((l)=>l.t==='CLIENT');
  assert.equal(emitter.x,50);
  assert.equal(client.x,320);
  assert.ok(model.lines.some((l)=>l.t==='Entreprise : Société Exemple' && l.x===320));
});
test('B4.2a-11b PDF encode le symbole euro WinAnsi au lieu du texte EUR',()=>{
  const s=buildCustomerInvoicePdf(invoice).toString('latin1');
  assert.ok(s.includes('\x80'));
  assert.doesNotMatch(s,/650,00 EUR/);
});

test('B4.2a-11c facture réelle affiche le vrai numéro et jamais la mention brouillon',()=>{
  const s=buildCustomerInvoicePdf(invoice).toString('latin1');
  assert.match(s,/FACTURE N° LMV-2026-0001/);
  assert.match(s,/Date d'émission/);
  assert.doesNotMatch(s,/Document non émis - sans numéro de facture|APERÇU - BROUILLON DE FACTURE/);
});
test('B4.2a-11c entreprise est explicitement libellée sous le nom du client',()=>{
  const withCompany={...invoice,customer_snapshot:{...invoice.customer_snapshot,company_name:'Société Exemple'}};
  const lines=invoicePdfModel(withCompany).lines.filter((l)=>l.x===320).map((l)=>l.t);
  const person=lines.indexOf('Jean Test');
  const company=lines.indexOf('Entreprise : Société Exemple');
  assert.ok(person>=0);
  assert.equal(company,person+1);
});

test('B4.2a-11d espace supplémentaire après le titre uniquement dans aperçu brouillon',()=>{
  const draft={...invoice,status:'draft',invoice_number:null,issued_at:null};
  const previewLines=invoicePdfModel(draft,{preview:true}).lines;
  const titleIndex=previewLines.findIndex((l)=>l.t==='APERÇU - BROUILLON DE FACTURE');
  assert.ok(titleIndex>=0);
  assert.equal(previewLines[titleIndex+1]?.t,'');
  assert.equal(previewLines[titleIndex+1]?.size,12);
  const issuedLines=invoicePdfModel(invoice).lines;
  assert.equal(issuedLines.some((l)=>l.t==='Document non émis - sans numéro de facture'),false);
  assert.ok(issuedLines.some((l)=>l.t===`FACTURE N° ${invoice.invoice_number}`));
});
