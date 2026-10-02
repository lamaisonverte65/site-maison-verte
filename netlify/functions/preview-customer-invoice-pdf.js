import { createClient } from '@supabase/supabase-js';
import { authorizationResponse, authorizeAdminRequest } from './_lib/admin-auth.js';
import { buildCustomerInvoicePdf } from './_lib/customer-invoice-pdf.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Méthode non autorisée.' });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  const invoiceId = String(event.queryStringParameters?.invoiceId || '').trim();
  if (!invoiceId) return json(400, { error: 'Facture manquante.' });
  const { data: invoice, error } = await supabase.from('customer_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error || !invoice) return json(404, { error: 'Facture introuvable.' });
  if (invoice.status !== 'draft') return json(409, { error: 'L’aperçu sans émission est réservé aux brouillons.' });
  let pdf;
  try { pdf = buildCustomerInvoicePdf(invoice, { preview: true }); }
  catch (e) { return json(409, { error: 'Aperçu PDF impossible à générer.', detail: String(e?.message || e) }); }
  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="apercu-facture.pdf"',
      'Cache-Control': 'private, no-store',
    },
    body: pdf.toString('base64'),
  };
}
