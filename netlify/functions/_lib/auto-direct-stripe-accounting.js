// B1 — Comptabilisation automatique SANS effet sur les statuts Stripe, la réservation
// ou les emails. Même projection et mêmes clés idempotentes que le rattrapage admin.
// Les cas incomplets restent à contrôler dans Déclarations > Imports.
import { planDirectStripeAccounting } from './direct-stripe-accounting-import.js';

const PAYMENT_FIELDS = 'id,booking_request_id,payment_type,amount,currency,status,stripe_payment_intent_id,stripe_checkout_session_id,paid_at';
const CHARGE_FIELDS = 'id,payment_id,payment_intent_id,type,amount,fee,net,currency';
const ENTRY_FIELDS = 'id,entry_date,entry_kind,amount_ttc,source,source_record_key,external_reference,booking_request_id';

function checked(result, name) {
  if (result?.error) throw new Error(`${name}: ${result.error.message || 'erreur de lecture'}`);
  return result?.data ?? [];
}

export async function applyAutoDirectStripeAccounting({ payment, transactions, entries, categories, insertEntries }) {
  if (!payment?.id || payment.status !== 'paid') return { outcome: 'not_eligible' };
  const year = Number(String(payment.paid_at || '').slice(0, 4));
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return { outcome: 'needs_review', reason: 'Date de paiement manquante ou invalide' };
  // La projection est FAIL-CLOSED : aucune somme réservataire cumulée, aucun montant inféré.
  const plan = planDirectStripeAccounting({ year, payments: [payment], transactions, entries, categories, selectedIds: [String(payment.id)] });
  const line = plan.rows[0];
  if (line.status === 'blocked') return { outcome: 'needs_review', reason: line.reason };
  if (line.status === 'already_recorded') return { outcome: 'already_recorded', created: 0 };
  if (plan.readyCount !== 1 || plan.inserts.length < 1 || plan.inserts.length > 2) {
    return { outcome: 'needs_review', reason: 'Projection comptable incohérente' };
  }
  // Insertion atomique, sans upsert. La contrainte unique (source, source_record_key)
  // empêche qu'un webhook dupliqué ou un rattrapage concurrent écrive deux fois.
  try {
    await insertEntries(plan.inserts);
    return { outcome: 'created', created: plan.inserts.length };
  } catch (error) {
    // Une autre exécution peut avoir gagné la course. Le GET admin permet de
    // confirmer l'état final ; ne JAMAIS écraser l'écriture déjà en place.
    if (String(error?.code) === '23505') return { outcome: 'concurrent_write', created: 0 };
    throw error;
  }
}

async function getSinglePayment(supabase, { paymentId, checkoutSessionId }) {
  if (!paymentId && !checkoutSessionId) return null;
  let query = supabase.from('payments').select(PAYMENT_FIELDS);
  query = paymentId ? query.eq('id', paymentId) : query.eq('stripe_checkout_session_id', checkoutSessionId);
  const result = await query.maybeSingle();
  if (result?.error) throw new Error(`Paiement Stripe: ${result.error.message || 'erreur de lecture'}`);
  return result?.data || null;
}

export async function syncAutoDirectStripeAccounting(supabase, { paymentId = null, checkoutSessionId = null } = {}) {
  const payment = await getSinglePayment(supabase, { paymentId, checkoutSessionId });
  if (!payment) return { outcome: 'not_found' };
  // Les paiements spéciaux et les remboursements attendent une qualification comptable.
  if (payment.status !== 'paid' || !['full', 'deposit', 'balance'].includes(payment.payment_type)) {
    return { outcome: 'not_eligible' };
  }
  if (!payment.booking_request_id || !payment.stripe_payment_intent_id) {
    return { outcome: 'needs_review', reason: 'Liaison réservation ou PaymentIntent absente' };
  }
  const [byPaymentResult, byIntentResult, entriesResult, categoriesResult] = await Promise.all([
    supabase.from('stripe_balance_transactions').select(CHARGE_FIELDS).eq('payment_id', payment.id).eq('type', 'charge'),
    supabase.from('stripe_balance_transactions').select(CHARGE_FIELDS).eq('payment_intent_id', payment.stripe_payment_intent_id).eq('type', 'charge'),
    supabase.from('accounting_entries').select(ENTRY_FIELDS).eq('booking_request_id', payment.booking_request_id),
    supabase.from('accounting_categories').select('id,entry_kind,code').in('code', ['rental_direct', 'payment_fees']),
  ]);
  const transactions = [...new Map([
    ...checked(byPaymentResult, 'Transactions par paiement'),
    ...checked(byIntentResult, 'Transactions par PaymentIntent'),
  ].map(tx => [String(tx.id), tx])).values()];
  // Bloquer les incohérences de liaison même si la projection connaît l'autre identifiant.
  if (transactions.some(tx =>
    (tx.payment_id && String(tx.payment_id) !== String(payment.id)) ||
    (tx.payment_intent_id && tx.payment_intent_id !== payment.stripe_payment_intent_id)
  )) return { outcome: 'needs_review', reason: 'Identifiants de transaction Stripe incohérents' };

  return applyAutoDirectStripeAccounting({
    payment, transactions,
    entries: checked(entriesResult, 'Écritures existantes'),
    categories: checked(categoriesResult, 'Catégories comptables'),
    insertEntries: async (rows) => {
      const result = await supabase.from('accounting_entries').insert(rows);
      if (result?.error) throw result.error;
    },
  });
}
