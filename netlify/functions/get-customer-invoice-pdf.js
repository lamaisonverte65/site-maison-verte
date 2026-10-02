import { createClient } from '@supabase/supabase-js';
import { authorizationResponse, authorizeAdminRequest } from './_lib/admin-auth.js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Méthode non autorisée.' });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  const invoiceId = String(event.queryStringParameters?.invoiceId || '').trim();
  if (!invoiceId) return json(400, { error: 'Facture manquante.' });
  const { data: invoice, error } = await supabase.from('customer_invoices').select('invoice_number,pdf_storage_path').eq('id', invoiceId).maybeSingle();
  if (error || !invoice) return json(404, { error: 'Facture introuvable.' });
  if (!invoice.pdf_storage_path) return json(409, { error: 'PDF non archivé.' });
  const { data, error: downloadError } = await supabase.storage.from('customer-invoices').download(invoice.pdf_storage_path);
  if (downloadError || !data) return json(404, { error: 'PDF archivé introuvable.' });
  const bytes = Buffer.from(await data.arrayBuffer());
  return { statusCode: 200, isBase64Encoded: true, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`, 'Cache-Control': 'private, no-store' }, body: bytes.toString('base64') };
}
