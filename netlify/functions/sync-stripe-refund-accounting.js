// Rattrapage autonome et idempotent des allocations déjà confirmées côté Stripe.
// Jamais stripe.refunds.create, aucune mutation de paiement ou réservation.
import { schedule } from '@netlify/functions';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { syncConfirmedRefundAccounting } from './_lib/auto-direct-stripe-refund-accounting.js';
import { reconcilePendingStripeRefunds } from './_lib/reconcile-delayed-stripe-refund.js';
import { finalizePendingStripeRefundOperations, dispatchPendingRefundNotifications } from './_lib/finalize-delayed-stripe-refund.js';

export async function reconcileSavedStripeRefunds(supabase, stripe, {pageSize = 100, maxRows = 5000} = {}) {
  const outcomes = {created: 0, already_recorded: 0, needs_review: 0, concurrent_write: 0, failed: 0, other: 0};
  let processed = 0;
  for (let start = 0; start < maxRows; start += pageSize) {
    const response = await supabase.from('refunds').select('id')
      .eq('status', 'succeeded').not('stripe_refund_id', 'is', null)
      .order('id', {ascending: true}).range(start, start + pageSize - 1);
    if (response.error) throw new Error(`Lecture rattrapage refunds : ${response.error.message}`);
    const rows = response.data || [];
    for (const allocation of rows) {
      try {
        const result = await syncConfirmedRefundAccounting(supabase, stripe, {allocationId: allocation.id});
        if (Object.hasOwn(outcomes, result.outcome)) outcomes[result.outcome]++;
        else outcomes.other++;
      } catch (error) {
        outcomes.failed++;
        console.error('Rattrapage comptable remboursement', allocation.id, error);
      }
      processed++;
    }
    if (rows.length < pageSize) return {processed, outcomes, truncated: false};
  }
  // Un lot incomplet n'est jamais présenté comme un contrôle exhaustif.
  return {processed, outcomes, truncated: true};
}


// Détection seulement : remboursements effectués hors de l'application.
// Aucun enregistrement dans refunds ou dans le journal sans allocation locale fiable.
export async function auditUnlinkedStripeRefunds(supabase, stripe, {sinceSeconds, maxRows = 2000} = {}) {
  const lowerBound = sinceSeconds ?? Math.floor(Date.now() / 1000) - 90 * 86400;
  const stripeIds = [];
  let cursor = null;
  let hasMore = false;
  let inspected = 0;
  do {
    const page = await stripe.refunds.list({limit: Math.min(100, maxRows - inspected),
      created: {gte: lowerBound}, ...(cursor ? {starting_after: cursor} : {})});
    if (!Array.isArray(page?.data) || typeof page?.has_more !== 'boolean') {
      throw new Error('Pagination remboursements Stripe non fiable');
    }
    inspected += page.data.length;
    stripeIds.push(...page.data.filter(refund => refund.status === 'succeeded').map(refund => refund.id));
    if (!page.has_more) {hasMore = false; break;}
    hasMore = true;
    const lastId = page.data.at(-1)?.id;
    if (!lastId || lastId === cursor) throw new Error('Curseur remboursement Stripe invalide');
    cursor = lastId;
    // Le maximum s'applique aux identifiants traités ; si la limite est atteinte,
    // l'audit est explicitement déclaré incomplet, jamais présenté comme exhaustif.
  } while (inspected < maxRows);

  const linkedCount = new Map();
  for (let index = 0; index < stripeIds.length; index += 100) {
    const values = stripeIds.slice(index, index + 100);
    const response = await supabase.from('refunds').select('stripe_refund_id,status,operation_status')
      .in('stripe_refund_id', values);
    if (response.error) throw new Error(`Audit liens Stripe : ${response.error.message}`);
    for (const row of response.data || []) {
      if (row.status === 'succeeded' && row.operation_status === 'succeeded') {
        linkedCount.set(row.stripe_refund_id, (linkedCount.get(row.stripe_refund_id) || 0) + 1);
      }
    }
  }
  const unlinkedIds = stripeIds.filter(id => linkedCount.get(id) !== 1);
  return {inspected, succeeded: stripeIds.length, unlinkedIds, truncated: hasMore};
}

export const handler = schedule('37 4 * * *', async () => {
  const supabase = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const pending = await reconcilePendingStripeRefunds(supabase, stripe);
  if (pending.outcomes.recovered_requires_finalization) {
    console.warn('Remboursements confirmés tardivement : finalisation métier/admin requise :',
      pending.outcomes.recovered_requires_finalization);
  }
  // La récupération R1 fait disparaître l'allocation du scanner pending ;
  // R2 finalise donc les opérations stripe_succeeded indépendamment.
  const finalizations = await finalizePendingStripeRefundOperations(supabase, stripe);
  const pendingNotifications = await dispatchPendingRefundNotifications(supabase, {stripe});
  // Les états d'envoi incertain sont contrôlables, mais jamais rejoués seuls.
  const notificationReviewResponse = await supabase.from('refund_notification_outbox')
    .select('refund_operation_id,status').in('status',['sending','needs_review']).limit(101);
  if (notificationReviewResponse.error) throw new Error(`Contrôle notifications : ${notificationReviewResponse.error.message}`);
  const notificationReview = notificationReviewResponse.data || [];
  if (notificationReview.length) console.warn('Notifications de remboursement à contrôler manuellement :',
    notificationReview.length > 100 ? 'plus de 100' : notificationReview.length);
  const result = await reconcileSavedStripeRefunds(supabase, stripe);
  console.log('Rattrapage journal des remboursements Stripe :', result);
  const external = await auditUnlinkedStripeRefunds(supabase, stripe);
  if (external.unlinkedIds.length) console.warn('Remboursements Stripe non reliés à vérifier :', external.unlinkedIds);
  if (pending.truncated || finalizations.truncated || pendingNotifications.truncated || notificationReview.length > 100 || result.truncated || external.truncated) throw new Error('Contrôle Stripe incomplet : plafond atteint');
  return {statusCode: 200, body: JSON.stringify({pending,finalizations,pendingNotifications,notificationReviewCount:notificationReview.length, result, externalUnlinkedCount: external.unlinkedIds.length})};
});
