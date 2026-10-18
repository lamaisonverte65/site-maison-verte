// B1/2B2 — Projection comptable d'une ALLOCATION confirmée, jamais une action de remboursement.
// Ne crée ni charge Stripe, ni modification des réservations, ni email.
export function stripeRefundParisDate(created) {
  if (!Number.isInteger(created) || created < 1_500_000_000 || created > 4_102_444_800) return null;
  const date = new Date(created * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
  const part = (name) => parts.find((item) => item.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const cents = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.00001) return null;
  return Math.round(number * 100);
};
const str = (value) => value == null ? '' : String(value);
const review = (reason) => ({outcome: 'needs_review', reason});
const keyFor = (allocation) => `direct:refund:${allocation.id}`;

export function planDirectRefundAccounting({allocation, operation, payment, stripeRefund, entries = [], category}) {
  if (!allocation?.id || !allocation.operation_id || !allocation.payment_id || !allocation.booking_request_id
    || !allocation.stripe_refund_id) return review('Allocation incomplète');
  if (allocation.status !== 'succeeded' || allocation.operation_status !== 'succeeded'
    || !['succeeded', 'stripe_succeeded'].includes(operation?.status)) return {outcome: 'not_confirmed'};
  if (str(operation.id) !== str(allocation.operation_id)
    || str(operation.booking_request_id) !== str(allocation.booking_request_id)
    || str(payment?.id) !== str(allocation.payment_id)
    || str(payment?.booking_request_id) !== str(allocation.booking_request_id)
    || !payment?.stripe_payment_intent_id) return review('Liens opération, réservation et paiement incohérents');
  if (!['paid', 'partially_refunded', 'refunded'].includes(payment.status)
    || !['eur', 'EUR'].includes(payment.currency)
    || !['eur', 'EUR'].includes(allocation.currency)) return review('Paiement ou devise non éligible');
  const amount = Number(allocation.amount_cents);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount !== cents(allocation.amount)) return review('Montant de l’allocation invalide');
  if (!stripeRefund || stripeRefund.status !== 'succeeded' || stripeRefund.id !== allocation.stripe_refund_id
    || stripeRefund.payment_intent !== payment.stripe_payment_intent_id
    || stripeRefund.payment_intent !== allocation.stripe_payment_intent_id
    || stripeRefund.amount !== amount || str(stripeRefund.currency).toLowerCase() !== 'eur') {
    return review('Preuve Stripe incohérente ou remboursement non confirmé');
  }
  if (str(stripeRefund.metadata?.refund_operation_id) !== str(operation.id)
    || str(stripeRefund.metadata?.refund_allocation_id) !== str(allocation.id)
    || str(stripeRefund.metadata?.payment_id) !== str(payment.id)) return review('Métadonnées Stripe non concordantes');
  const entryDate = stripeRefundParisDate(stripeRefund.created);
  if (!entryDate) return review('Date financière Stripe absente ou invalide');
  if (!category?.id || category.is_active === false || category.code !== 'direct_stripe_refund' || category.entry_kind !== 'refund') return review('Catégorie de restitution manquante');

  // Anciennes écritures éventuelles sur l'opération (B1 historique) : ne pas superposer
  // une écriture par allocation au même mouvement sans examen manuel.
  const legacy = entries.filter((entry) => entry.entry_kind === 'refund' && (
    str(entry.source_record_key) === `direct:refund:${operation.id}`
    || str(entry.source_record_key) === str(operation.id)
    || str(entry.external_reference) === str(operation.id)
  ));
  if (legacy.length) return review('Écriture historique par opération : rapprochement manuel nécessaire');
  const matches = entries.filter((entry) => str(entry.source_record_key) === keyFor(allocation)
    || (entry.entry_kind === 'refund' && str(entry.external_reference) === str(stripeRefund.id)));
  if (matches.length > 1) return review('Plusieurs écritures de remboursement liées');
  if (matches.length === 1) {
    const entry = matches[0];
    if (entry.entry_kind !== 'refund' || entry.source !== 'stripe'
      || entry.source_record_key !== keyFor(allocation)
      || str(entry.external_reference) !== stripeRefund.id
      || entry.booking_request_id !== allocation.booking_request_id
      || entry.entry_date !== entryDate || cents(entry.amount_ttc) !== amount) return review('Écriture existante incompatible');
    return {outcome: 'already_recorded', created: 0};
  }
  const duplicateManual = entries.some((entry) => entry.entry_kind === 'refund'
    && str(entry.booking_request_id) === str(allocation.booking_request_id)
    && !str(entry.source_record_key).startsWith('direct:refund:')
    && str(entry.entry_date) === entryDate && cents(entry.amount_ttc) === amount);
  if (duplicateManual) return review('Remboursement comptabilisé sans liaison explicite');
  return {outcome: 'ready', entry: {
    entry_date: entryDate, entry_kind: 'refund', category_id: category.id,
    label: 'Remboursement client Stripe — Direct', amount_ttc: amount / 100,
    treatment: 'to_review', source: 'stripe', source_record_key: keyFor(allocation),
    operation_group_key: `direct:refund-operation:${operation.id}`,
    external_reference: stripeRefund.id, booking_request_id: allocation.booking_request_id,
    payment_method: 'stripe', metadata: {
      refund_allocation_id: allocation.id, refund_operation_id: operation.id, payment_id: payment.id,
      payment_intent_id: payment.stripe_payment_intent_id, stripe_refund_id: stripeRefund.id,
      stripe_created: stripeRefund.created, accounting_date_basis: 'stripe_created_europe_paris',
    },
  }};
}

function checked(response, label) {
  if (response?.error) throw new Error(`${label} : ${response.error.message || 'lecture impossible'}`);
  return response?.data ?? null;
}

export async function syncConfirmedRefundAccounting(supabase, stripe, {allocationId = null, stripeRefundId = null} = {}) {
  if (!allocationId && !stripeRefundId) return review('Identifiant de remboursement obligatoire');
  const query = supabase.from('refunds').select('id,operation_id,payment_id,booking_request_id,amount,amount_cents,currency,status,operation_status,stripe_refund_id,stripe_payment_intent_id');
  const allocation = checked(await (allocationId ? query.eq('id', allocationId) : query.eq('stripe_refund_id', stripeRefundId)).maybeSingle(), 'Allocation');
  if (!allocation) return {outcome: 'not_found'}; // Stripe externe : aucun lien local, aucune écriture inventée.
  if (allocation.status !== 'succeeded' || allocation.operation_status !== 'succeeded') return {outcome:'not_confirmed'};
  if (!allocation.stripe_refund_id) return review('Identifiant Stripe manquant');
  const entryFields = 'id,entry_kind,entry_date,amount_ttc,source,source_record_key,external_reference,booking_request_id';
  const operationKey = `direct:refund:${allocation.operation_id}`;
  const allocationKey = keyFor(allocation);
  const [op, pay, cats, ledger, byKeys, byReferences] = await Promise.all([
    supabase.from('refund_operations').select('id,booking_request_id,status').eq('id', allocation.operation_id).maybeSingle(),
    supabase.from('payments').select('id,booking_request_id,currency,status,stripe_payment_intent_id').eq('id', allocation.payment_id).maybeSingle(),
    supabase.from('accounting_categories').select('id,entry_kind,code,is_active').eq('code', 'direct_stripe_refund'),
    supabase.from('accounting_entries').select(entryFields).eq('booking_request_id', allocation.booking_request_id),
    supabase.from('accounting_entries').select(entryFields).in('source_record_key', [allocationKey, operationKey, allocation.operation_id]),
    supabase.from('accounting_entries').select(entryFields).in('external_reference', [allocation.stripe_refund_id, allocation.operation_id]),
  ]);
  const categories = checked(cats, 'Catégorie');
  const operation = checked(op, 'Opération');
  const payment = checked(pay, 'Paiement');
  const entries = [...new Map([
    ...(checked(ledger, 'Journal réservation') || []),
    ...(checked(byKeys, 'Clés comptables') || []),
    ...(checked(byReferences, 'Références comptables') || []),
  ].map(entry => [entry.id, entry])).values()];
  // On lit l'objet auprès de Stripe, sans se fier à une ancienne capture JSON locale.
  const stripeRefund = await stripe.refunds.retrieve(allocation.stripe_refund_id);
  const plan = planDirectRefundAccounting({allocation, operation, payment, stripeRefund, entries,
    category: categories?.find(c => c.entry_kind === 'refund')});
  if (plan.outcome !== 'ready') return plan;
  const result = await supabase.from('accounting_entries').insert([plan.entry]);
  if (result?.error?.code === '23505') return {outcome: 'concurrent_write', created: 0};
  if (result?.error) throw new Error(`Insertion remboursement comptable : ${result.error.message}`);
  return {outcome: 'created', created: 1};
}

export async function syncRefundOperationAccounting(supabase, stripe, operationId) {
  if (!operationId) return review('Identifiant opération absent');
  const response = await supabase.from('refunds').select('id').eq('operation_id', operationId).eq('status', 'succeeded');
  const allocations = checked(response, 'Allocations de l’opération') || [];
  if (allocations.length >= 1000) throw new Error('Trop d’allocations dans l’opération : rattrapage incomplet');
  const results = [];
  for (const allocation of allocations) results.push({allocationId: allocation.id,
    ...(await syncConfirmedRefundAccounting(supabase, stripe, {allocationId: allocation.id}))});
  return {results};
}
