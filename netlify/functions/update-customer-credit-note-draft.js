import { createClient } from '@supabase/supabase-js';
import { authorizationResponse, authorizeAdminRequest } from './_lib/admin-auth.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
const toCents = (value) => Math.round(Number(value) * 100);

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corps JSON invalide.' }); }
  const creditNoteId = String(body.creditNoteId || '').trim();
  const accommodationRefund = Number(body.accommodationRefund);
  const cleaningRefund = Number(body.cleaningRefund);
  if (!creditNoteId) return json(400, { error: 'Avoir manquant.' });
  if (![accommodationRefund, cleaningRefund].every((v) => Number.isFinite(v) && v >= 0)) return json(400, { error: 'Ventilation invalide.' });

  const { data: note, error } = await supabase.from('customer_credit_notes').select('*').eq('id', creditNoteId).maybeSingle();
  if (error || !note) return json(404, { error: 'Avoir introuvable.' });
  if (note.status !== 'draft') return json(409, { error: 'Seul un brouillon d’avoir peut être modifié.' });
  const refundSnapshot = note.refund_snapshot || {};
  const refunded_amount_cents = Number(refundSnapshot.refunded_amount_cents);
  const tourist_tax_refund_cents = Number(refundSnapshot.tourist_tax_refund_cents || 0);
  if (!Number.isInteger(refunded_amount_cents) || refunded_amount_cents <= 0 || !Number.isInteger(tourist_tax_refund_cents) || tourist_tax_refund_cents < 0) return json(409, { error: 'Snapshot de remboursement incomplet.' });
  if (toCents(accommodationRefund) + toCents(cleaningRefund) + tourist_tax_refund_cents !== refunded_amount_cents) return json(409, { error: 'La ventilation doit correspondre exactement au remboursement.' });

  const financial = {
    ...(note.financial_snapshot || {}),
    accommodation_refund: accommodationRefund,
    cleaning_refund: cleaningRefund,
    tourist_tax_refund: tourist_tax_refund_cents / 100,
    manual_required: false,
  };
  const { data: updated, error: updateError } = await supabase.from('customer_credit_notes')
    .update({ financial_snapshot: financial, updated_at: new Date().toISOString() })
    .eq('id', note.id).eq('status', 'draft').select('*').single();
  if (updateError) return json(500, { error: 'Mise à jour du brouillon impossible.', detail: updateError.message });
  return json(200, { creditNote: updated });
}
