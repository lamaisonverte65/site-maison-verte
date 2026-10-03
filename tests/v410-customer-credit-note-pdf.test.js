import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const libPath='netlify/functions/_lib/customer-credit-note-pdf.js';
const lib=fs.existsSync(libPath)?fs.readFileSync(libPath,'utf8'):'';
const preview=fs.existsSync('netlify/functions/preview-customer-credit-note-pdf.js')?fs.readFileSync('netlify/functions/preview-customer-credit-note-pdf.js','utf8'):'';
const archive=fs.existsSync('netlify/functions/archive-customer-credit-note-pdf.js')?fs.readFileSync('netlify/functions/archive-customer-credit-note-pdf.js','utf8'):'';
const get=fs.existsSync('netlify/functions/get-customer-credit-note-pdf.js')?fs.readFileSync('netlify/functions/get-customer-credit-note-pdf.js','utf8'):'';
const service=fs.readFileSync('src/services/invoiceService.js','utf8');
test('credit note PDF has dedicated wording and original invoice reference',()=>{
  for(const term of ["APERÇU - BROUILLON D'AVOIR",'AVOIR N°','Avoir relatif à la facture','Hébergement remboursé','Ménage remboursé','Taxe de séjour remboursée',"TOTAL DE L'AVOIR",'Avoir partiel','Avoir total']) assert.match(lib,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
test('preview and archive are owner-only with correct states and private storage',()=>{
  assert.match(preview,/ownerOnly:\s*true/); assert.match(preview,/status !== 'draft'/); assert.match(preview,/preview:\s*true/);
  assert.match(archive,/ownerOnly:\s*true/); assert.match(archive,/status !== 'issued'/); assert.match(archive,/upsert:\s*false/); assert.match(archive,/avoirs\//);
  assert.match(get,/ownerOnly:\s*true/); assert.match(get,/private, no-store/);
});
test('frontend exposes issue preview archive and open credit note functions',()=>{
  assert.match(service,/issueCreditNote/); assert.match(service,/admin_issue_customer_credit_note/);
  assert.match(service,/openCreditNotePreviewPdf/); assert.match(service,/archiveCreditNotePdf/); assert.match(service,/openCreditNotePdf/);
});
