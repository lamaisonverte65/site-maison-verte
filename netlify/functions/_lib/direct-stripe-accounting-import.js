// B1 — Projection déterministe et sans écriture des mouvements Direct Stripe.
// Tous les montants sont contrôlés au centime. Aucune somme au niveau réservation
// ne remplace un mouvement individuel de paiement ou une balance transaction.
// Ces statuts prouvent un encaissement historique : un remboursement ultérieur
// ne supprime pas l'obligation de comptabiliser la recette et les frais initiaux.
// La restitution reste comptabilisée séparément par l'outbox des remboursements.
import { accountingParisDate } from './accounting-paris-date.js';

const PAID = new Set(['paid', 'partially_refunded', 'refunded']);
const TYPES = new Set(['full', 'deposit', 'balance']);

function cents(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const result = Math.round(n * 100);
  return Number.isSafeInteger(result) && Math.abs(n * 100 - result) < 0.000001 ? result : null;
}
function iso(value) {
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : null;
}
function sameId(a, b) { return a != null && b != null && String(a) === String(b); }
function linkedStripe(payment, charge) {
  return charge.type === 'charge' && (
    sameId(charge.payment_id, payment.id) ||
    (payment.stripe_payment_intent_id && sameId(charge.payment_intent_id, payment.stripe_payment_intent_id))
  );
}
function collision(entry, payment, day, expectedCents, kind) {
  return entry.entry_kind === kind && sameId(entry.booking_request_id, payment.booking_request_id)
    && iso(entry.entry_date) === day && cents(entry.amount_ttc) === expectedCents;
}
function keyFor(payment, kind) {
  return kind === 'income' ? `direct:payment:${payment.id}` : `direct:fee:${payment.id}`;
}
function matchingLinkedEntries(entries, payment, kind) {
  const k = keyFor(payment, kind);
  return entries.filter(entry => String(entry.source_record_key || '') === k);
}

export function planDirectStripeAccounting({ year, payments = [], transactions = [], entries = [], categories = [], selectedIds = null }) {
  if (!Number.isInteger(year) || year < 2024 || year > 2100) throw new Error('Exercice invalide.');
  const wanted = selectedIds === null ? null : new Set(selectedIds.map(String));
  if (wanted !== null && (!wanted.size || wanted.size > 50)) throw new Error('Sélection invalide (1 à 50 paiements).');
  const byId = new Map();
  for (const payment of payments) {
    if (payment.id != null) {
      const id = String(payment.id);
      if (byId.has(id)) throw new Error('Identifiant de paiement présent plusieurs fois.');
      byId.set(id, payment);
    }
  }
  if (wanted) for (const id of wanted) if (!byId.has(id)) throw new Error(`Paiement introuvable : ${id}`);
  const categoryIncome = categories.find(c => c.code === 'rental_direct' && c.entry_kind === 'income')?.id || null;
  const categoryFees = categories.find(c => c.code === 'payment_fees' && c.entry_kind === 'expense')?.id || null;
  const rows = [];
  const inserts = [];
  // Une même balance transaction ne doit jamais justifier deux encaissements.
  const chargeUse = new Map();
  for (const payment of payments) {
    if (!payment?.id || (wanted && !wanted.has(String(payment.id)))) continue;
    for (const charge of transactions.filter(t => linkedStripe(payment, t))) {
      chargeUse.set(String(charge.id), (chargeUse.get(String(charge.id)) || 0) + 1);
    }
  }
  for (const payment of payments) {
    if (!payment.id || (wanted && !wanted.has(String(payment.id)))) continue;
    const day = accountingParisDate(payment.paid_at);
    if (String(day || '').slice(0, 4) !== String(year)) {
      if (wanted) rows.push({ id: String(payment.id), status: 'blocked', reason: 'Paiement hors exercice ou date paid_at absente' });
      continue;
    }
    const amountCents = cents(payment.amount);
    const charges = transactions.filter(t => linkedStripe(payment, t));
    let reason = '';
    if (!payment.booking_request_id) reason = 'Réservation liée absente';
    else if (!PAID.has(payment.status)) reason = 'Paiement initial non confirmé';
    else if (!TYPES.has(payment.payment_type)) reason = 'Type de paiement à qualifier (ménage, supplément ou manuel)';
    else if (!payment.stripe_payment_intent_id) reason = 'Identifiant Stripe PaymentIntent absent';
    else if (String(payment.currency || '').toLowerCase() !== 'eur') reason = 'Devise du paiement non confirmée en EUR';
    else if (amountCents === null || amountCents <= 0) reason = 'Montant du paiement inconnu ou nul';
    else if (charges.length !== 1) reason = 'Transaction Stripe absente ou ambiguë';
    const charge = charges.length === 1 ? charges[0] : null;
    if (!reason && (chargeUse.get(String(charge.id)) || 0) > 1) reason = 'Une transaction Stripe justifie plusieurs paiements';
    const feeCents = cents(charge?.fee);
    const netCents = cents(charge?.net);
    if (!reason && (String(charge.currency || '').toLowerCase() !== 'eur'
      || cents(charge.amount) !== amountCents || feeCents === null || netCents === null
      || amountCents - feeCents !== netCents)) reason = 'Montants ou devise Stripe discordants';
    if (!reason && (!categoryIncome || (feeCents > 0 && !categoryFees))) reason = 'Catégories comptables requises introuvables';

    const existingIncome = matchingLinkedEntries(entries, payment, 'income');
    const existingFee = matchingLinkedEntries(entries, payment, 'expense');
    const incomeKey = keyFor(payment, 'income');
    const feeKey = keyFor(payment, 'expense');
    const otherKeyCollision = entries.some(e => [incomeKey,feeKey].includes(String(e.source_record_key || ''))
      && !((e.entry_kind === 'income' && String(e.source_record_key) === incomeKey)
        || (e.entry_kind === 'expense' && String(e.source_record_key) === feeKey)));
    if (!reason && (existingIncome.length > 1 || existingFee.length > 1 || otherKeyCollision)) reason = 'Clé comptable ambiguë';
    const validEntry = (entry, kind, expected) => entry && entry.source === 'stripe'
      && entry.entry_kind === kind && entry.source_record_key === keyFor(payment, kind)
      && sameId(entry.booking_request_id, payment.booking_request_id)
      && iso(entry.entry_date) === day && cents(entry.amount_ttc) === expected;
    if (!reason && existingIncome.length && !validEntry(existingIncome[0], 'income', amountCents)) reason = 'Recette liée existante incohérente';
    if (!reason && existingFee.length && !validEntry(existingFee[0], 'expense', feeCents)) reason = 'Frais liés existants incohérents';
    if (!reason && entries.some(e => e.entry_kind === 'income' && !existingIncome.includes(e)
      && ((collision(e, payment, day, amountCents, 'income'))
        || String(e.external_reference || '') === String(payment.stripe_payment_intent_id)))) reason = 'Recette déjà saisie ou correspondance ambiguë';
    if (!reason && feeCents > 0 && entries.some(e => e.entry_kind === 'expense' && !existingFee.includes(e)
      && collision(e, payment, day, feeCents, 'expense'))) reason = 'Frais déjà saisis ou correspondance ambiguë';

    const status = reason ? 'blocked' : (existingIncome.length && (feeCents === 0 || existingFee.length) ? 'already_recorded' : 'ready');
    rows.push({ id: String(payment.id), bookingRequestId: payment.booking_request_id,
      date: day, paymentType: payment.payment_type, amountCents, feeCents, netCents,
      stripeId: payment.stripe_payment_intent_id || null, status, reason: reason || null,
      receiptAlready: existingIncome.length === 1, feeAlready: existingFee.length === 1 });
    if (status !== 'ready') continue;
    const base = { entry_date: day, treatment: 'current', source: 'stripe',
      booking_request_id: payment.booking_request_id, external_reference: payment.stripe_payment_intent_id,
      payment_method: 'stripe', operation_group_key: `direct:payment:${payment.id}`,
      metadata: { payment_id: String(payment.id), stripe_balance_transaction_id: String(charge.id), payment_type: payment.payment_type, provenance: 'direct_stripe_accounting_b1' } };
    if (!existingIncome.length) inserts.push({ ...base, entry_kind: 'income', category_id: categoryIncome,
      source_record_key: incomeKey, label: `Encaissement direct Stripe ${payment.payment_type} ${payment.id}`,
      counterparty: 'Client direct', amount_ttc: amountCents / 100 });
    if (feeCents > 0 && !existingFee.length) inserts.push({ ...base, entry_kind: 'expense', category_id: categoryFees,
      source_record_key: feeKey, label: `Frais Stripe paiement ${payment.id}`,
      counterparty: 'Stripe', amount_ttc: feeCents / 100 });
  }
  if (wanted && rows.length !== wanted.size) throw new Error('La sélection ne correspond pas aux paiements disponibles.');
  return { year, rows, inserts, readyCount: rows.filter(r => r.status === 'ready').length,
    blockedCount: rows.filter(r => r.status === 'blocked').length,
    alreadyCount: rows.filter(r => r.status === 'already_recorded').length,
    grossToCreateCents: inserts.filter(e => e.entry_kind === 'income').reduce((s,e) => s + Math.round(e.amount_ttc * 100), 0),
    feesToCreateCents: inserts.filter(e => e.entry_kind === 'expense').reduce((s,e) => s + Math.round(e.amount_ttc * 100), 0) };
}
