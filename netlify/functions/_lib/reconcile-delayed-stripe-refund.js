// Rattrapage STRICTEMENT borné d'une allocation locale dont Stripe a confirmé
// le remboursement après la première tentative. Aucun refund.create, aucune
// finalisation métier ou notification : celle-ci requiert le parcours admin.
const str = (value) => value == null ? '' : String(value);
const review = (reason) => ({outcome: 'needs_review', reason});
const checked = (response, name) => {
  if (response?.error) throw new Error(`${name} : ${response.error.message || 'lecture impossible'}`);
  return response?.data ?? null;
};
const cents = (value) => {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)
    || number < 0 || Math.abs(number * 100 - Math.round(number * 100)) > 0.00001) return null;
  return Math.round(number * 100);
};

export function verifyDelayedRefundProof({allocation, operation, payment, stripeRefund}) {
  if (!allocation?.id || !allocation.operation_id || !allocation.booking_request_id
    || !allocation.payment_id || !allocation.stripe_refund_id) return review('Allocation locale incomplète');
  if (allocation.status === 'succeeded' && allocation.operation_status === 'succeeded') {
    return {outcome: 'already_confirmed'};
  }
  if (allocation.operation_status === 'failed' || allocation.status === 'failed') {
    return review('Remboursement local en échec : vérification manuelle obligatoire');
  }
  if (operation?.status === 'succeeded') return review('Opération déjà finalisée, allocation incohérente');
  if (str(operation?.id) !== str(allocation.operation_id)
    || str(operation?.booking_request_id) !== str(allocation.booking_request_id)
    || str(payment?.id) !== str(allocation.payment_id)
    || str(payment?.booking_request_id) !== str(allocation.booking_request_id)
    || !payment?.stripe_payment_intent_id
    || payment.stripe_payment_intent_id !== allocation.stripe_payment_intent_id
    || !['paid', 'partially_refunded', 'refunded'].includes(payment.status)
    || str(payment.currency).toLowerCase() !== 'eur'
    || str(allocation.currency).toLowerCase() !== 'eur') return review('Liens opération, paiement et réservation non concordants');
  const amountCents = Number(allocation.amount_cents);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0
    || amountCents !== cents(allocation.amount)) return review('Montant local invalide');
  if (!stripeRefund || stripeRefund.id !== allocation.stripe_refund_id) return review('Identifiant Stripe non concordant');
  if (stripeRefund.status !== 'succeeded') return {outcome: 'not_confirmed'};
  if (stripeRefund.payment_intent !== payment.stripe_payment_intent_id
    || stripeRefund.amount !== amountCents || str(stripeRefund.currency).toLowerCase() !== 'eur'
    || str(stripeRefund.metadata?.refund_operation_id) !== str(operation.id)
    || str(stripeRefund.metadata?.refund_allocation_id) !== str(allocation.id)
    || str(stripeRefund.metadata?.payment_id) !== str(payment.id)) {
    return review('Preuve Stripe non concordante : aucune mutation');
  }
  return {outcome: 'ready'};
}

export async function reconcileDelayedStripeRefund(supabase, stripe, {stripeRefundId, allocationId} = {}) {
  if (!stripeRefundId && !allocationId) return review('Identifiant obligatoire');
  const query = supabase.from('refunds').select('id,operation_id,payment_id,booking_request_id,amount,amount_cents,currency,status,operation_status,stripe_refund_id,stripe_payment_intent_id');
  const allocation = checked(await (allocationId ? query.eq('id', allocationId) : query.eq('stripe_refund_id', stripeRefundId)).maybeSingle(), 'Allocation');
  if (!allocation) return {outcome: 'not_found'};
  if (stripeRefundId && allocation.stripe_refund_id !== stripeRefundId) return review('Identifiant Stripe différent');
  if (allocation.status === 'succeeded' && allocation.operation_status === 'succeeded') return {outcome: 'already_confirmed'};
  if (!allocation.stripe_refund_id || allocation.operation_status === 'failed' || allocation.status === 'failed') {
    return review('Allocation non réconciliable automatiquement');
  }
  const [operationResponse, paymentResponse] = await Promise.all([
    supabase.from('refund_operations').select('id,booking_request_id,status').eq('id', allocation.operation_id).maybeSingle(),
    supabase.from('payments').select('id,booking_request_id,status,currency,stripe_payment_intent_id').eq('id', allocation.payment_id).maybeSingle(),
  ]);
  const operation = checked(operationResponse, 'Opération');
  const payment = checked(paymentResponse, 'Paiement');
  // Source autoritaire distante : ne jamais utiliser le seul statut d'un événement Webhook.
  const stripeRefund = await stripe.refunds.retrieve(allocation.stripe_refund_id);
  const proof = verifyDelayedRefundProof({allocation, operation, payment, stripeRefund});
  if (proof.outcome !== 'ready') return proof;
  const result = checked(await supabase.rpc('record_stripe_refund_result', {
    p_operation_id: allocation.operation_id,
    p_allocation_id: allocation.id,
    p_stripe_refund_id: stripeRefund.id,
    p_stripe_status: stripeRefund.status,
    p_stripe_metadata: stripeRefund,
  }), 'Confirmation locale Stripe');
  if (!['recorded', 'stripe_succeeded', 'already_recorded'].includes(result?.outcome)) {
    return review('Résultat de confirmation locale inattendu');
  }
  // NE PAS appeler finalize_stripe_refund_operation ici : elle change la réservation
  // et renvoie should_notify. Le parcours métier doit traiter cette notification.
  return {outcome: 'recovered_requires_finalization', operationId: allocation.operation_id, allocationId: allocation.id};
}

// Keyset: une mise à jour de status ne peut pas faire sauter la ligne suivante.
export async function reconcilePendingStripeRefunds(supabase, stripe, {pageSize = 50, maxRows = 500} = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !Number.isInteger(maxRows) || maxRows < 1) throw new Error('Limites de pagination invalides');
  const outcomes = {recovered_requires_finalization: 0, already_confirmed: 0,
    not_confirmed: 0, needs_review: 0, not_found: 0, failed: 0};
  let processed = 0;
  let cursor = null;
  while (processed < maxRows) {
    const limit = Math.min(pageSize, maxRows - processed);
    let query = supabase.from('refunds').select('id')
      .neq('status', 'succeeded').not('stripe_refund_id', 'is', null)
      .order('id', {ascending: true}).limit(limit);
    if (cursor != null) query = query.gt('id', cursor);
    const response = await query;
    if (response?.error) throw new Error(`Lecture remboursements différés : ${response.error.message}`);
    const rows = response?.data || [];
    if (!rows.length) return {processed, outcomes, truncated: false};
    for (const allocation of rows) {
      cursor = allocation.id;
      try {
        const result = await reconcileDelayedStripeRefund(supabase, stripe, {allocationId: allocation.id});
        if (Object.hasOwn(outcomes, result.outcome)) outcomes[result.outcome]++;
        else outcomes.needs_review++;
      } catch (error) {
        outcomes.failed++;
        console.error('Rattrapage remboursement différé', allocation.id, error);
      }
      processed++;
    }
    if (rows.length < limit) return {processed, outcomes, truncated: false};
  }
  return {processed, outcomes, truncated: true};
}
