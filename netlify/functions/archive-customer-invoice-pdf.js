import { createClient } from '@supabase/supabase-js';
import { authorizationResponse, authorizeAdminRequest } from './_lib/admin-auth.js';
import { buildCustomerInvoicePdf } from './_lib/customer-invoice-pdf.js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corps JSON invalide.' }); }
  const invoiceId = String(body.invoiceId || '').trim();
  if (!invoiceId) return json(400, { error: 'Facture manquante.' });
  const { data: invoice, error } = await supabase.from('customer_invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (error || !invoice) return json(404, { error: 'Facture introuvable.' });
  if (invoice.status !== 'issued') return json(409, { error: 'La facture doit être émise avant génération du PDF.' });
  if (invoice.pdf_storage_path) return json(200, { invoice, archived: false });
  const path = `${String(invoice.invoice_number).slice(4, 8)}/${invoice.invoice_number}.pdf`;
  let pdf; try { pdf = buildCustomerInvoicePdf(invoice); } catch (e) { return json(409, { error: 'PDF impossible à générer.', detail: String(e?.message || e) }); }
  const { error: uploadError } = await supabase.storage.from('customer-invoices').upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError && !/already exists|duplicate/i.test(String(uploadError.message || ''))) return json(500, { error: 'Archivage PDF impossible.' });
  const { data: updated, error: updateError } = await supabase.from('customer_invoices').update({ pdf_storage_path: path, updated_at: new Date().toISOString() }).eq('id', invoice.id).is('pdf_storage_path', null).select('*').maybeSingle();
  if (updateError) return json(500, { error: 'PDF archivé mais rattachement impossible.' });
  if (updated) return json(200, { invoice: updated, archived: true });
  const { data: current } = await supabase.from('customer_invoices').select('*').eq('id', invoice.id).single();
  return json(200, { invoice: current, archived: false });
}
