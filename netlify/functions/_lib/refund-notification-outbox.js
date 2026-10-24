// Notification métier du remboursement : une intention par opération SQL.
// L'envoi est réservé atomiquement ; un état d'envoi incertain reste en revue
// humaine plutôt que d'être retransmis par un webhook/retry automatique.
import { escapeHtml } from './html.js';
import { emailLanguageForAudience } from '../../../shared/guestLocale.js';
import { buildLocalizedRefundNotification } from './guest-refund-emails.js';
import { resendEmail } from './resend-email.js';
import { expireBookingOpenCheckoutSessions } from './stripe-checkout-session.js';

const formatDate = (value) => value ? new Date(value).toLocaleDateString('fr-FR') : '-';
const formatCurrency = (value) => new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR'}).format(Number(value || 0));

export function buildRefundNotificationPayload(operation) {
  if (!operation || operation.status !== 'succeeded' || !['refund_only', 'cancel_refund'].includes(operation.action)) {
    throw new Error('Opération métier non finalisée ou action inconnue');
  }
  const booking = operation.result?.booking;
  if (!booking?.id || String(booking.id) !== String(operation.booking_request_id)) {
    throw new Error('Snapshot de réservation finalisée manquant ou incohérent');
  }
  const amount = Number(operation.refunded_amount_cents);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Montant finalisé invalide');
  const refundOnly = operation.action === 'refund_only';
  if (operation.action === 'cancel_refund' && booking.status !== 'cancelled') {
    throw new Error('Annulation non confirmée dans le snapshot');
  }
  if (!booking.guest_email || (refundOnly && amount === 0)) return null;
  const cancellationType = operation.cancellation_type;
  if (!['owner','client'].includes(cancellationType)) throw new Error('Type d’annulation invalide');
  const subject = refundOnly ? 'Remboursement effectué - La Maison Verte'
    : cancellationType === 'owner' ? 'Annulation de votre réservation - La Maison Verte'
      : 'Confirmation d’annulation - La Maison Verte';
  const message = operation.message || '';
  const label = operation.policy_label || 'Remboursement';
  const amountEur = amount / 100;
  const body = refundOnly ? `
      <h2>Remboursement effectué</h2>
      <p>Bonjour ${escapeHtml(booking.guest_first_name || '')} ${escapeHtml(booking.guest_last_name || '')},</p>
      <p>Nous vous confirmons qu’un remboursement de <strong>${formatCurrency(amountEur)}</strong> a été déclenché via Stripe concernant votre séjour à <strong>La Maison Verte à Arreau</strong>.</p>
      <p><strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br /><strong>Départ :</strong> ${formatDate(booking.end_date)}</p>
      ${message ? `<p><strong>Message :</strong><br />${escapeHtml(message)}</p>` : ''}
      <p><strong>Motif :</strong><br />${escapeHtml(label)}</p>
      <p>Ce remboursement ne modifie pas automatiquement votre réservation. Le délai d’apparition sur votre compte bancaire dépend de votre banque.</p>` : `
      <h2>${subject}</h2>
      <p>Bonjour ${escapeHtml(booking.guest_first_name || '')} ${escapeHtml(booking.guest_last_name || '')},</p>
      <p>Nous vous confirmons l’annulation de la réservation à <strong>La Maison Verte à Arreau</strong>.</p>
      <p><strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br /><strong>Départ :</strong> ${formatDate(booking.end_date)}</p>
      ${message ? `<p><strong>Message :</strong><br />${escapeHtml(message)}</p>` : ''}
      <p><strong>Règle appliquée :</strong><br />${escapeHtml(label)}</p>
      ${amountEur > 0 ? `<p>Un remboursement de <strong>${formatCurrency(amountEur)}</strong> a été déclenché via Stripe. Le délai d’apparition sur le compte bancaire dépend de votre banque.</p>` : '<p>Aucun remboursement Stripe n’a été déclenché pour cette annulation.</p>'}`;
  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${body}
      <p style="margin-top:30px;font-size:13px;color:#666;">Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages, puis ajoutez contact@lamaisonverte65.fr à vos contacts.</p>
    </div>`;
  // R5 : seul le texte voyageur varie. Les garde-fous, l'outbox et
  // l'intention Stripe finalisée restent strictement inchangés.
  // Le libellé de politique et le message libre sont reproduits sans traduction
  // automatique : ne jamais modifier une règle de remboursement.
  const language = emailLanguageForAudience(booking);
  const localized = language === 'fr' ? null : buildLocalizedRefundNotification({
    language, booking, refundOnly, cancellationType, amountEur, message, policyLabel: label,
  });
  const emailSubject = localized?.subject || subject;
  const emailHtml = localized?.html || html;
  return {
    payload: {from:'La Maison Verte <contact@lamaisonverte65.fr>',to:[booking.guest_email],
      reply_to:'contact@lamaisonverte65.fr',subject:emailSubject,html:emailHtml},
    bookingId: booking.id,
    emailType: refundOnly ? 'refund_only' : 'booking_cancelled_refund',
    metadata: {refundOperationId:operation.id,cancellationType,refundedAmount:amountEur,policyLabel:label},
  };
}

async function requireData(resultOrPromise, name) {
  const result = await resultOrPromise;
  if (result?.error) throw new Error(`${name} : ${result.error.message}`);
  return result?.data;
}

export async function dispatchRefundNotification(supabase, operationId, {send = resendEmail, stripe = null} = {}) {
  if (!operationId) throw new Error('Identifiant opération requis');
  const operation = await requireData(await supabase.from('refund_operations')
    .select('id,booking_request_id,status,action,cancellation_type,message,policy_label,refunded_amount_cents,result')
    .eq('id', operationId).maybeSingle(), 'Lecture opération de remboursement');
  if (!operation || operation.status !== 'succeeded') return {outcome:'not_finalized'};

  // Valider le snapshot AVANT de prendre la réservation : si elle est incohérente,
  // laisser pending pour audit, sans consommer la seule possibilité d'envoi.
  let notification;
  try { notification = buildRefundNotificationPayload(operation); }
  catch (error) { return {outcome:'needs_review',reason:error.message}; }

  // Une annulation ne peut être annoncée si une session de paiement reste ouverte.
  // Les appels ultérieurs sont idempotents côté Stripe (statut déjà expiré).
  if (operation.action === 'cancel_refund') {
    if (!stripe) return {outcome:'needs_review',reason:'Stripe indisponible pour expirer les sessions'};
    try { await expireBookingOpenCheckoutSessions(stripe, operation.result.booking); }
    catch(error) { return {outcome:'needs_review',reason:`Expiration Checkout à vérifier : ${error.message}`}; }
  }

  const claim = await requireData(await supabase.rpc('claim_completed_refund_notification', {
    p_operation_id:operationId,
  }), 'Réservation notification');
  if (claim?.outcome !== 'claimed') return {outcome:claim?.outcome || 'needs_review'};

  const complete = async (status, providerId = null, errorMessage = null) => {
    const saved = await requireData(await supabase.rpc('complete_refund_notification', {
      p_operation_id:operationId,p_status:status,p_provider_id:providerId,p_last_error:errorMessage,
    }), 'Fin notification');
    if (saved?.outcome !== status) throw new Error('Fin notification non confirmée en base');
    return saved;
  };
  if (!notification) {
    await complete('not_applicable');
    return {outcome:'not_applicable'};
  }

  let response;
  try { response = await send(notification.payload); }
  catch (error) {
    await complete('needs_review',null,String(error.message || error));
    return {outcome:'needs_review',reason:'Envoi incertain : ne pas rejouer automatiquement'};
  }
  let providerId = null;
  let deliveryConfirmed = false;
  let deliveryError = null;
  if (response?.ok) {
    const responseData = await response.json().catch(() => null);
    providerId = typeof responseData?.id === 'string' && responseData.id.trim()
      ? responseData.id.trim() : null;
    deliveryConfirmed = Boolean(providerId);
    if (deliveryConfirmed) {
      // Verrouiller l'envoi en base avant email_logs : aucun renvoi sur défaut de log.
      await complete('sent', providerId);
    } else {
      // Un HTTP 2xx sans ID Resend ne permet pas de prouver l'acceptation.
      deliveryError = 'Réponse Resend positive sans identifiant fournisseur : contrôle manuel';
      await complete('needs_review', null, deliveryError);
    }
  } else {
    const body = await response?.text?.().catch(() => 'réponse illisible') || 'Échec envoi';
    deliveryError = String(body).slice(0, 1000);
    await complete('needs_review', null, deliveryError);
  }
  try {
    const {error} = await supabase.from('email_logs').insert([{
      booking_request_id:notification.bookingId,email_type:notification.emailType,
      to_email:notification.payload.to[0],subject:notification.payload.subject,
      status:deliveryConfirmed ? 'sent':'error',provider_id:providerId,
      error_message:deliveryConfirmed ? null:deliveryError,
      retry_payload:null,sent_at:new Date().toISOString(),metadata:notification.metadata,
    }]);
    if (error) console.error('Journalisation email remboursement en échec :',error.message);
  } catch(error) { console.error('Journalisation email remboursement impossible :',error); }
  return {outcome:deliveryConfirmed ? 'sent':'needs_review',
    ...(deliveryError ? {reason:deliveryError} : {})};
}

// Parcours borné. Un état sending/needs_review requiert une décision humaine :
// le réseau peut avoir transmis l'email même si l'accusé de réception a disparu.
export async function dispatchPendingRefundNotifications(supabase, {limit = 50, send = resendEmail, stripe = null} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Limite invalidée');
  const rows = await requireData(await supabase.from('refund_notification_outbox')
    .select('refund_operation_id').eq('status','pending')
    .order('created_at',{ascending:true}).limit(limit + 1), 'Lecture notifications en attente');
  const outcomes = {sent:0,not_applicable:0,needs_review:0,other:0};
  for (const row of (rows || []).slice(0,limit)) {
    try {
      const result = await dispatchRefundNotification(supabase,row.refund_operation_id,{send,stripe});
      if (Object.hasOwn(outcomes,result.outcome)) outcomes[result.outcome]++;
      else outcomes.other++;
    } catch(error) {
      outcomes.needs_review++;
      console.error('Notification remboursement en attente :',row.refund_operation_id,error);
    }
  }
  return {processed:Math.min(rows?.length || 0,limit),truncated:(rows?.length || 0)>limit,outcomes};
}
