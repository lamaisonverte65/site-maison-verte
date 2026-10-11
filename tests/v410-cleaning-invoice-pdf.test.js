import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invoicePdfModel } from '../netlify/functions/_lib/customer-invoice-pdf.js';

const panel = fs.readFileSync('src/components/admin/InvoicesPanel.jsx', 'utf8');
const service = fs.readFileSync('src/services/invoiceService.js', 'utf8');

test('cleaning invoice PDF identifies post stay cleaning and omits accommodation/tourist tax lines', () => {
  const invoice = {
    status:'draft', invoice_kind:'post_stay_cleaning', source:'direct', total_amount:50,
    seller_snapshot:{ legal_name:'Raphaël BENOIT', accommodation_name:'La Maison Verte', accommodation_address:'3 Impasse Trassens', accommodation_postal_code:'65240', accommodation_city:'Arreau' },
    customer_snapshot:{ first_name:'Jean', last_name:'Test' },
    stay_snapshot:{ start_date:'2026-10-01', end_date:'2026-10-04', accommodation_name:'La Maison Verte' },
    financial_snapshot:{ accommodation_net:0, cleaning_fee:50, tourist_tax_amount:0 },
    payment_snapshot:[{ payment_type:'manual', manual_reason:'cleaning', amount:50, status:'paid', paid_at:'2026-10-04' }],
  };
  const model = invoicePdfModel(invoice, { preview:true });
  const text = model.lines.map((line) => line.t || '').join('\n');
  assert.match(text, /MÉNAGE APRÈS SÉJOUR/i);
  assert.doesNotMatch(text, /^Hébergement$/m);
  assert.doesNotMatch(text, /^Taxe de séjour$/m);
});

test('invoice UI and service expose complementary cleaning invoice type', () => {
  assert.match(service, /createCleaningInvoiceDraft/);
  assert.match(panel, /Ménage après séjour/);
  assert.match(panel, /invoice_kind/);
});
