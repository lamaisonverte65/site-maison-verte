import { createClient } from '@supabase/supabase-js';
import { authorizeAdminRequest, authorizationResponse } from './_lib/admin-auth.js';
import { planDirectStripeAccounting } from './_lib/direct-stripe-accounting-import.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const json = (statusCode, body) => ({ statusCode, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0',
}, body: JSON.stringify(body) });
const unique = (items) => [...new Set((items || []).filter(Boolean).map(String))];
const checked = (r, label) => {
  if (r?.error) throw new Error(`${label} : ${r.error.message || 'Erreur de lecture'}`);
  return r?.data || [];
};
async function getPlan(year, ids) {
  const start = `${year}-01-01T00:00:00Z`;
  const end = `${year + 1}-01-01T00:00:00Z`;
  const [paymentsResponse, categoryResponse] = await Promise.all([
    supabase.from('payments')
      .select('id,booking_request_id,payment_type,amount,currency,status,stripe_payment_intent_id,paid_at')
      .gte('paid_at', start).lt('paid_at', end),
    supabase.from('accounting_categories').select('id,entry_kind,code')
      .in('code', ['rental_direct', 'payment_fees']),
  ]);
  const payments = checked(paymentsResponse, 'Paiements');
  const categories = checked(categoryResponse, 'Catégories');
  const bookingIds = unique(payments.map(p => p.booking_request_id));
  const paymentIds = unique(payments.map(p => p.id));
  const intents = unique(payments.map(p => p.stripe_payment_intent_id));
  const queryOrEmpty = (values, build) => values.length ? build() : Promise.resolve({ data: [], error: null });
  const [byPayments, byIntents, entryByBookings] = await Promise.all([
    queryOrEmpty(paymentIds, () => supabase.from('stripe_balance_transactions')
      .select('id,payment_id,payment_intent_id,type,amount,fee,net,currency')
      .in('payment_id', paymentIds).eq('type', 'charge')),
    queryOrEmpty(intents, () => supabase.from('stripe_balance_transactions')
      .select('id,payment_id,payment_intent_id,type,amount,fee,net,currency')
      .in('payment_intent_id', intents).eq('type', 'charge')),
    queryOrEmpty(bookingIds, () => supabase.from('accounting_entries')
      .select('id,entry_date,entry_kind,amount_ttc,source,source_record_key,external_reference,booking_request_id')
      .in('booking_request_id', bookingIds)),
  ]);
  const transactions = [...new Map([
    ...checked(byPayments, 'Transactions Stripe par paiement'),
    ...checked(byIntents, 'Transactions Stripe par identifiant')
  ].map(t => [String(t.id), t])).values()];
  const entries = checked(entryByBookings, 'Écritures liées');
  return planDirectStripeAccounting({ year, payments, transactions, entries, categories, selectedIds: ids });
}

export async function handler(event) {
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Méthode interdite.' });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  const isWrite = event.httpMethod === 'POST';
  let body = {};
  if (isWrite) {
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Corps JSON invalide.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Corps JSON invalide.' });
  }
  const year = Number(isWrite ? body.year : event.queryStringParameters?.year);
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return json(400, { error: 'Exercice invalide.' });
  const ids = isWrite ? body.paymentIds : null;
  if (isWrite && (!Array.isArray(ids) || !ids.length || ids.length > 50
    || ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 128)
    || new Set(ids).size !== ids.length)) return json(400, { error: 'Identifiants de paiement invalides.' });
  try {
    const plan = await getPlan(year, ids);
    const { inserts, ...publicPlan } = plan;
    if (!isWrite) return json(200, publicPlan);
    // Une opération explicitement sélectionnée mais devenue ambiguë bloque TOUT le lot.
    if (plan.blockedCount) return json(409, { error: 'Paiement(s) à vérifier : aucune écriture créée.', plan: publicPlan });
    if (!inserts.length) return json(200, { ...publicPlan, created: 0, alreadyApplied: true });
    // Une seule instruction INSERT, atomique. La contrainte UNIQUE (source, source_record_key)
    // rejette la concurrence ; aucun update, delete, upsert ni valeur fournie par le navigateur.
    const result = await supabase.from('accounting_entries').insert(inserts);
    if (result.error) {
      if (result.error.code === '23505') return json(409, { error: 'Écriture créée entre-temps : actualiser avant de confirmer. Aucune écriture de ce lot n’a été créée.' });
      throw new Error(`Enregistrement des écritures : ${result.error.message}`);
    }
    return json(200, { ...publicPlan, created: inserts.length, alreadyApplied: false });
  } catch (error) {
    console.error('Direct Stripe accounting import:', error);
    return json(500, { error: 'Impossible de contrôler ou créer les écritures Stripe. Aucune écriture ne doit être présumée enregistrée.' });
  }
}
