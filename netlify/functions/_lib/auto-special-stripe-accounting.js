// V4.13 F1.2 — Comptabilisation distincte des paiements hors contrat.
// Une preuve de dossier payé est obligatoire : jamais de recours à contract_total.
import { accountingParisDate } from './accounting-paris-date.js';

const SETTLED = new Set(['paid', 'partially_refunded', 'refunded']);
const INCOME_CODES = Object.freeze({
  post_stay_cleaning: 'post_stay_cleaning',
  extra_bed: 'additional_extra_bed',
  cleaning: 'post_stay_cleaning',
  damage: 'other_income',
  other: 'other_income',
});
const PAYMENT_FIELDS = 'id,booking_request_id,payment_type,manual_reason,amount,currency,status,stripe_checkout_session_id,stripe_payment_intent_id,paid_at,metadata';
const TX_FIELDS = 'id,payment_id,payment_intent_id,type,amount,fee,net,currency';
const ENTRY_FIELDS = 'id,entry_date,entry_kind,amount_ttc,source,source_record_key,external_reference,booking_request_id,metadata';
const SPECIAL_FIELDS = 'id,booking_request_id,payment_id,status,amount,category,invoice_id';
const CLEANING_FIELDS = 'id,booking_request_id,payment_id,status,amount_due,invoice_id';

function toCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const cents = Math.round(n * 100);
  return Number.isSafeInteger(cents) && Math.abs(n * 100 - cents) < 0.000001 ? cents : null;
}
function dayOf(value) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : null;
}
function idEq(a, b) { return a != null && b != null && String(a) === String(b); }
function keyFor(payment, fee = false) { return `direct:${fee ? 'fee' : 'payment'}:${payment.id}`; }
function checked(result, label) {
  if (result?.error) throw new Error(`${label}: ${result.error.message || 'échec de lecture'}`);
  return result?.data ?? [];
}

export function planSpecialStripeAccounting({ payment, context, transactions = [], entries = [], categories = [] }) {
  if (!payment?.id || payment.payment_type !== 'manual' || !['cleaning', 'post_stay_cleaning', 'additional_charge'].includes(payment.manual_reason))
    return { outcome: 'not_eligible' };
  const review = (reason) => ({ outcome: 'needs_review', reason });
  if (!SETTLED.has(payment.status)) return { outcome: 'not_eligible' };
  if (payment.booking_request_id != null) return review('Paiement spécial rattaché au contrat');
  if (!context?.item || !context?.bookingRequestId || !context?.id) return review('Dossier métier introuvable');
  if (context.item.status !== 'paid' || !idEq(context.item.payment_id, payment.id) || !idEq(context.item.booking_request_id, context.bookingRequestId))
    return review('Dossier métier non confirmé ou liaison incohérente');
  const metadata = payment.metadata || {};
  const keyInMetadata = context.type === 'post_stay_cleaning' ? 'cleaning_issue_id' : 'additional_charge_id';
  if (!idEq(metadata[keyInMetadata], context.id) || !idEq(metadata.booking_id, context.bookingRequestId))
    return review('Identifiants métier du paiement incomplets ou discordants');
  if (!payment.stripe_payment_intent_id) return review('PaymentIntent absent');
  if (String(payment.currency || '').toLowerCase() !== 'eur') return review('Devise de paiement non prise en charge');
  const day = accountingParisDate(payment.paid_at);
  if (!day) return review('Date de paiement absente');
  const amount = toCents(payment.amount);
  const expected = toCents(context.type === 'post_stay_cleaning' ? context.item.amount_due : context.item.amount);
  if (amount === null || amount <= 0 || amount !== expected) return review('Montant du dossier métier discordant');
  const type = context.type === 'post_stay_cleaning' ? 'post_stay_cleaning' : context.item.category;
  const incomeCategory = INCOME_CODES[type];
  if (!incomeCategory) return review('Catégorie de supplément inconnue');
  const allCharges = transactions.filter(t => t.type === 'charge' && (
    idEq(t.payment_id, payment.id) || idEq(t.payment_intent_id, payment.stripe_payment_intent_id)));
  if (allCharges.length !== 1) return review('Transaction Stripe absente ou ambiguë');
  const tx = allCharges[0];
  if (!idEq(tx.payment_id, payment.id) || !idEq(tx.payment_intent_id, payment.stripe_payment_intent_id))
    return review('Liaison Stripe non vérifiée');
  const fee = toCents(tx.fee), net = toCents(tx.net);
  if (toCents(tx.amount) !== amount || fee === null || net === null || amount - fee !== net || String(tx.currency || '').toLowerCase() !== 'eur')
    return review('Montants/frais/devise Stripe discordants');
  const incomeCategoryId = categories.find(c => c.entry_kind === 'income' && c.code === incomeCategory)?.id;
  const feeCategoryId = categories.find(c => c.entry_kind === 'expense' && c.code === 'payment_fees')?.id;
  if (!incomeCategoryId || (fee > 0 && !feeCategoryId)) return review('Catégories comptables spécifiques absentes');
  const incomeKey = keyFor(payment);
  const feeKey = keyFor(payment, true);
  const incomes = entries.filter(e => e.source_record_key === incomeKey);
  const fees = entries.filter(e => e.source_record_key === feeKey);
  if (incomes.length > 1 || fees.length > 1) return review('Clés comptables présentes plusieurs fois');
  const isExpected = (entry, kind, amountCents, key) => entry?.source === 'stripe'
    && entry.entry_kind === kind && entry.source_record_key === key
    && idEq(entry.booking_request_id, context.bookingRequestId)
    && dayOf(entry.entry_date) === day && toCents(entry.amount_ttc) === amountCents
    && idEq(entry.metadata?.payment_id, payment.id)
    && idEq(entry.metadata?.[keyInMetadata], context.id);
  if ((incomes.length && !isExpected(incomes[0], 'income', amount, incomeKey))
    || (fees.length && !isExpected(fees[0], 'expense', fee, feeKey)))
    return review('Écriture comptable liée existante incohérente');
  if (entries.some(e => e.source_record_key && [incomeKey, feeKey].includes(e.source_record_key)
    && ![...incomes, ...fees].includes(e))) return review('Collision de clé comptable');
  if (entries.some(e => e.entry_kind === 'income' && !incomes.includes(e)
    && (String(e.external_reference || '') === String(payment.stripe_payment_intent_id)
    || (idEq(e.booking_request_id, context.bookingRequestId) && dayOf(e.entry_date) === day
      && toCents(e.amount_ttc) === amount && !e.source_record_key))))
    return review('Recette existante potentiellement saisie manuellement');
  if (fee > 0 && entries.some(e => e.entry_kind === 'expense' && !fees.includes(e)
    && (String(e.external_reference || '') === String(payment.stripe_payment_intent_id)
    || (idEq(e.booking_request_id, context.bookingRequestId) && dayOf(e.entry_date) === day
      && toCents(e.amount_ttc) === fee && !e.source_record_key))))
    return review('Frais existants potentiellement saisis manuellement');
  if (incomes.length && (fee === 0 || fees.length)) return { outcome: 'already_recorded', created: 0 };
  const needsFiscalReview = ['damage', 'other'].includes(type);
  const base = {
    entry_date: day, source: 'stripe', booking_request_id: context.bookingRequestId,
    external_reference: payment.stripe_payment_intent_id, payment_method: 'stripe',
    operation_group_key: `direct:payment:${payment.id}`,
    metadata: { payment_id: String(payment.id), stripe_balance_transaction_id: String(tx.id),
      payment_type: 'manual', [keyInMetadata]: String(context.id),
      additional_charge_category: context.type === 'additional_charge' ? type : undefined,
      fiscal_review_required: needsFiscalReview, provenance: 'direct_special_stripe_accounting_f12' },
  };
  const inserts = [];
  if (!incomes.length) inserts.push({ ...base, entry_kind: 'income', category_id: incomeCategoryId,
    treatment: needsFiscalReview ? 'to_review' : 'current', source_record_key: incomeKey,
    label: context.type === 'post_stay_cleaning' ? `Ménage après séjour ${context.id}` : `Supplément ${type} ${context.id}`,
    counterparty: 'Client direct', amount_ttc: amount / 100 });
  if (fee > 0 && !fees.length) inserts.push({ ...base, entry_kind: 'expense', category_id: feeCategoryId,
    treatment: 'current', source_record_key: feeKey, label: `Frais Stripe paiement complémentaire ${payment.id}`,
    counterparty: 'Stripe', amount_ttc: fee / 100 });
  return { outcome: 'ready', inserts };
}

async function singlePayment(supabase, { paymentId, checkoutSessionId }) {
  if (!paymentId && !checkoutSessionId) return null;
  const query = supabase.from('payments').select(PAYMENT_FIELDS);
  const result = paymentId ? await query.eq('id', paymentId).maybeSingle()
    : await query.eq('stripe_checkout_session_id', checkoutSessionId).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function syncAutoSpecialStripeAccounting(supabase, { paymentId = null, checkoutSessionId = null } = {}) {
  const payment = await singlePayment(supabase, { paymentId, checkoutSessionId });
  if (!payment) return { outcome: 'not_found' };
  if (payment.payment_type !== 'manual' || !['cleaning', 'post_stay_cleaning', 'additional_charge'].includes(payment.manual_reason))
    return { outcome: 'not_eligible' };
  const isCleaning = payment.manual_reason !== 'additional_charge';
  const table = isCleaning ? 'booking_cleaning_issues' : 'booking_additional_charges';
  const referenceKey = isCleaning ? 'cleaning_issue_id' : 'additional_charge_id';
  const referenceId = payment.metadata?.[referenceKey];
  if (!referenceId) return { outcome: 'needs_review', reason: 'Référence du dossier métier absente' };
  const [recordResult, txByPayment, txByIntent, categoriesResult] = await Promise.all([
    supabase.from(table).select(isCleaning ? CLEANING_FIELDS : SPECIAL_FIELDS).eq('id', referenceId).maybeSingle(),
    supabase.from('stripe_balance_transactions').select(TX_FIELDS).eq('payment_id', payment.id).eq('type', 'charge'),
    supabase.from('stripe_balance_transactions').select(TX_FIELDS).eq('payment_intent_id', payment.stripe_payment_intent_id).eq('type', 'charge'),
    supabase.from('accounting_categories').select('id,entry_kind,code').in('code', ['post_stay_cleaning','additional_extra_bed','other_income','payment_fees']),
  ]);
  if (recordResult.error) throw recordResult.error;
  const record = recordResult.data;
  if (!record) return { outcome: 'needs_review', reason: 'Dossier métier non trouvé' };
  const context = { type: isCleaning ? 'post_stay_cleaning' : 'additional_charge', id: record.id,
    bookingRequestId: record.booking_request_id, item: record };
  const day = accountingParisDate(payment.paid_at);
  if (!day) return { outcome: 'needs_review', reason: 'Date de paiement absente' };
  const year = day.slice(0,4);
  const bookingEntriesResult = await supabase.from('accounting_entries').select(ENTRY_FIELDS)
    .eq('booking_request_id', record.booking_request_id);
  const refEntriesResult = await supabase.from('accounting_entries').select(ENTRY_FIELDS)
    .eq('external_reference', payment.stripe_payment_intent_id);
  const transactions = [...new Map([...checked(txByPayment, 'Transactions liées'),
    ...checked(txByIntent, 'Transactions Stripe')].map(tx => [String(tx.id), tx])).values()];
  const entries = [...new Map([...checked(bookingEntriesResult, 'Journal réservation'),
    ...checked(refEntriesResult, 'Journal PaymentIntent')].map(e => [String(e.id),e])).values()];
  // La date et la réservation sont vérifiées dans la projection, même si une
  // écriture préexistante appartient à un autre exercice.
  const plan = planSpecialStripeAccounting({payment,context,transactions,entries,categories:checked(categoriesResult,'Catégories')});
  if (plan.outcome !== 'ready') return plan;
  try {
    const inserted = await supabase.from('accounting_entries').insert(plan.inserts);
    if (inserted.error) throw inserted.error;
    return { outcome: 'created', created: plan.inserts.length };
  } catch(error) {
    if (String(error?.code) === '23505') return { outcome:'concurrent_write', created:0 };
    throw error;
  }
}
