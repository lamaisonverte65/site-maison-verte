// Reprise métier d'une opération dont toutes les allocations ont été
// confirmées par record_stripe_refund_result. Jamais de stripe.refunds.create.
import { dispatchRefundNotification, dispatchPendingRefundNotifications } from './refund-notification-outbox.js';
const check = (r, name) => {
  if (r?.error) throw new Error(`${name} : ${r.error.message}`);
  return r?.data ?? null;
};
const review = (reason) => ({outcome:'needs_review',reason});

export function verifyFinalizationSnapshot(snapshot) {
  const operation = snapshot?.operation;
  const allocations = snapshot?.allocations;
  if (!operation?.id || !operation.booking_request_id || !Array.isArray(allocations)
    || !allocations.length) return review('Opération ou allocations incomplètes');
  if (operation.status === 'succeeded') return {outcome:'already_finalized'};
  if (operation.status !== 'stripe_succeeded') return review('Opération non entièrement confirmée');
  let total = 0;
  for (const allocation of allocations) {
    if (String(allocation.operation_id) !== String(operation.id)
      || String(allocation.booking_request_id) !== String(operation.booking_request_id)
      || allocation.status !== 'succeeded' || allocation.operation_status !== 'succeeded'
      || !allocation.stripe_refund_id || !Number.isSafeInteger(Number(allocation.amount_cents))
      || Number(allocation.amount_cents) <= 0) return review('Allocation non confirmée ou incohérente');
    total += Number(allocation.amount_cents);
  }
  if (!Number.isSafeInteger(total) || total !== Number(operation.refunded_amount_cents)) {
    return review('Total remboursements différent des allocations');
  }
  return {outcome:'ready'};
}

export async function finalizeDelayedStripeRefund(supabase, stripe, operationId, {send} = {}) {
  if (!operationId) return review('Identifiant opération manquant');
  const snapshot = check(await supabase.rpc('refund_operation_snapshot', {
    p_operation_id:operationId,
  }), 'Lecture snapshot remboursements');
  const proof = verifyFinalizationSnapshot(snapshot);
  if (proof.outcome === 'already_finalized') {
    return {outcome:'already_finalized'};
  }
  if (proof.outcome !== 'ready') return proof;

  const final = check(await supabase.rpc('finalize_stripe_refund_operation_with_notification', {
    p_operation_id:operationId,
  }), 'Finalisation remboursement');
  if (!['succeeded','already_succeeded'].includes(final?.outcome)) {
    return review(`Finalisation non aboutie : ${final?.outcome || 'inconnue'}`);
  }
  // La finalisation SQL met à jour la réservation, crée l'événement et déclenche
  // l'avoir brouillon éventuel. Le trigger SQL R2 crée l'intent email atomique.
  let notification;
  try {
    notification = await dispatchRefundNotification(supabase,operationId,{send,stripe});
  } catch (error) {
    // Une panne de notification après COMMIT ne doit pas masquer la finalisation
    // financière, ni pousser Stripe à réémettre le webhook ou créer un refund.
    console.error('Notification après finalisation SQL à contrôler :',operationId,error);
    notification = {outcome:'needs_review',reason:'Notification à vérifier après finalisation SQL'};
  }
  return {outcome:final.outcome==='succeeded' ? 'finalized':'already_finalized',
    operationId, notification:notification.outcome,notificationReason:notification.reason || null};
}

// Scanner les opérations, PAS les remboursements : R1 exclut après rattrapage
// les allocations devenues succeeded. Pagination keyset par ID.
export async function finalizePendingStripeRefundOperations(supabase, stripe, {
  pageSize = 50,maxRows = 500,send,
} = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100
    || !Number.isInteger(maxRows) || maxRows < 1) throw new Error('Pagination invalide');
  const outcomes = {finalized:0,already_finalized:0,needs_review:0,failed:0};
  let processed = 0;
  let cursor = null;
  while (processed < maxRows) {
    const limit = Math.min(pageSize,maxRows - processed);
    let query = supabase.from('refund_operations').select('id')
      .eq('status','stripe_succeeded').order('id',{ascending:true}).limit(limit);
    if (cursor) query = query.gt('id',cursor);
    const rows = check(await query,'Lecture opérations à finaliser') || [];
    if (!rows.length) return {processed,outcomes,truncated:false};
    for (const row of rows) {
      cursor = row.id;
      try {
        const result = await finalizeDelayedStripeRefund(supabase,stripe,row.id,{send});
        if (Object.hasOwn(outcomes,result.outcome)) outcomes[result.outcome]++;
        else outcomes.needs_review++;
        if (result.notification === 'needs_review' || result.notification === 'sending') {
          console.warn('Notification remboursement à contrôler :',row.id,result.notificationReason || result.notification);
        }
      } catch(error) {
        outcomes.failed++;
        console.error('Finalisation différée à reprendre :',row.id,error);
      }
      processed++;
    }
    if (rows.length < limit) return {processed,outcomes,truncated:false};
  }
  return {processed,outcomes,truncated:true};
}

export {dispatchPendingRefundNotifications};
