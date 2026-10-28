// Reprise d'emails : aucune nouvelle action métier. Les tentatives sont
// réservées par compare-and-swap sur les colonnes déjà présentes d'email_logs.
// Un crash après la réservation laisse la ligne en revue manuelle plutôt
// que de renvoyer potentiellement deux fois un message après 24 heures.
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_MINUTES = [15, 60, 360];
const CLAIM_HOLD_UNTIL = '9999-12-31T23:59:59.000Z';
const ACTIVE_STATUSES = new Set(['accepted', 'confirmed', 'paid', 'deposit_paid', 'fully_paid']);
const PAID_STATUSES = new Set(['confirmed', 'paid', 'deposit_paid', 'fully_paid']);
const TERMINAL_STATUSES = new Set(['cancelled', 'refused', 'expired']);

const asStatus = value => String(value || '').trim().toLowerCase();
const nextRetryAt = (attempts, now) => new Date(now.getTime() + BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60000).toISOString();
const manualMessage = reason => `Reprise automatique suspendue : ${reason}. Vérifier dans Resend et dans la réservation avant toute intervention.`;

function validPayload(payload) {
  return Boolean(payload && typeof payload === 'object' && typeof payload.from === 'string' &&
    Array.isArray(payload.to) && payload.to.length > 0 &&
    payload.to.every(value => typeof value === 'string' && value.includes('@')) &&
    typeof payload.subject === 'string' && typeof payload.html === 'string');
}

function initialDeliveryIsSafelyRetryable(row) {
  // Les journaux initiaux ne stockent pas la clé d'idempotence ni le statut HTTP.
  // Un 500, un timeout ou une erreur réseau ne prouvent pas que Resend n'a rien
  // envoyé. Seul un refus explicite de type rate limit est repris automatiquement.
  // Les autres erreurs restent en revue manuelle pour éviter tout doublon.
  const message = String(row.error_message || '');
  return /(?:\b429\b|too many requests|rate[_ -]?limit|débit limité)/i.test(message)
    && !/(?:network_error|socket|fetch failed|timeout|timed out|econnreset)/i.test(message);
}

export function retryRelevance(row, booking) {
  if (!row.booking_request_id) return { allowed: true };
  if (!booking) return { allowed: false, reason: 'réservation absente' };
  const status = asStatus(booking.status);
  const type = String(row.email_type || '');
  const ownerEmail = type.startsWith('owner_') || type === 'booking_request:owner' || type === 'cleaning_issue_owner_alert';
  const guestEmail = String(booking.guest_email || '').trim().toLowerCase();
  if (!ownerEmail && guestEmail && String(row.to_email || '').trim().toLowerCase() !== guestEmail) {
    return { allowed: false, reason: 'adresse du voyageur modifiée' };
  }

  if (type === 'booking_request:guest' || type === 'booking_request:owner') {
    return { allowed: status === 'pending', reason: 'demande déjà traitée' };
  }
  if (type === 'booking_decision:accepted') return { allowed: status === 'accepted', reason: 'acceptation devenue périmée' };
  if (type === 'booking_decision:refused') return { allowed: status === 'refused', reason: 'refus devenu périmé' };
  if (type === 'booking_decision:confirmed') return { allowed: PAID_STATUSES.has(status), reason: 'confirmation devenue périmée' };
  if (type === 'booking_expired' || type === 'owner_initial_payment_not_received') {
    return { allowed: status === 'expired', reason: 'expiration devenue périmée' };
  }
  if (type.startsWith('booking_decision:')) return { allowed: false, reason: 'type de décision inconnu' };

  if (TERMINAL_STATUSES.has(status)) {
    // Les notifications de remboursements disposent de leur propre outbox ;
    // les autres messages de réservation ne doivent pas être rejoués après clôture.
    return { allowed: false, reason: `réservation ${status}` };
  }
  if (type.startsWith('balance:')) {
    const balanceStatus = asStatus(booking.balance_status);
    const fullyPaid = ['paid', 'fully_paid', 'annulé', 'annule', 'cancelled'].includes(balanceStatus) ||
      asStatus(booking.payment_status) === 'fully_paid';
    return { allowed: ['deposit_paid', 'paid'].includes(status) && !fullyPaid, reason: 'solde non exigible ou déjà payé' };
  }
  if (type.startsWith('payment_confirmation:') || type.startsWith('owner_payment_status:')) {
    return { allowed: PAID_STATUSES.has(status), reason: 'paiement non confirmé dans la réservation' };
  }
  if (type === 'arrival_reminder' || type === 'review_request') {
    return { allowed: PAID_STATUSES.has(status), reason: 'séjour non confirmé' };
  }
  return { allowed: ACTIVE_STATUSES.has(status), reason: 'état de réservation non autorisé' };
}

async function readBooking(supabase, row) {
  if (!row.booking_request_id) return null;
  const { data, error } = await supabase.from('booking_requests')
    .select('id,status,guest_email,balance_status,payment_status')
    .eq('id', row.booking_request_id).maybeSingle();
  if (error) throw error; // Ne jamais conclure « réservation absente » sur erreur SQL.
  return data;
}

async function checkCurrentRelevance(supabase, row) {
  return retryRelevance(row, await readBooking(supabase, row));
}

async function wasSentLater(supabase, row) {
  let query = supabase.from('email_logs').select('id')
    .eq('email_type', row.email_type).eq('to_email', row.to_email)
    .eq('status', 'sent').gt('created_at', row.created_at).limit(1);
  query = row.booking_request_id
    ? query.eq('booking_request_id', row.booking_request_id)
    : query.is('booking_request_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return Boolean(data?.length);
}

function whereOriginal(query, row) {
  query = query.eq('id', row.id).eq('status', 'error').is('retry_exhausted_at', null)
    .eq('retry_attempts', Number(row.retry_attempts || 0));
  query = row.retry_last_at ? query.eq('retry_last_at', row.retry_last_at) : query.is('retry_last_at', null);
  query = row.retry_next_at ? query.eq('retry_next_at', row.retry_next_at) : query.is('retry_next_at', null);
  return query;
}

function whereClaim(query, claim) {
  return query.eq('id', claim.id).eq('status', 'error')
    .eq('retry_attempts', claim.attempts).eq('retry_last_at', claim.claimedAt)
    .eq('retry_next_at', CLAIM_HOLD_UNTIL);
}

async function updateExactlyOne(query, label) {
  const { data, error } = await query.select('id');
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) throw Error(`${label} : modification non confirmée`);
}

async function suppressRow(supabase, row, nowIso, reason) {
  await updateExactlyOne(whereOriginal(supabase.from('email_logs').update({
    retry_exhausted_at: nowIso, retry_next_at: null, error_message: manualMessage(reason),
  }), row), 'Suspension du retry');
}

async function claimRow(supabase, row, nowIso) {
  const attempts = Number(row.retry_attempts || 0) + 1;
  const query = whereOriginal(supabase.from('email_logs').update({
    retry_attempts: attempts, retry_last_at: nowIso,
    retry_next_at: CLAIM_HOLD_UNTIL,
    error_message: manualMessage('tentative réservée ; résultat inconnu en cas d’arrêt du processus'),
  }), row);
  const { data, error } = await query.select('id');
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) return null;
  return { id: row.id, attempts, claimedAt: nowIso };
}

async function finishClaim(supabase, claim, patch) {
  await updateExactlyOne(whereClaim(supabase.from('email_logs').update(patch), claim), 'Finalisation du retry');
}

export async function runFailedEmailRetryBatch({ supabase, sendEmail, now = new Date(), limit = 50 }) {
  const nowIso = now.toISOString();
  const { data: rows, error } = await supabase.from('email_logs')
    .select('id,booking_request_id,email_type,to_email,status,created_at,error_message,retry_payload,retry_attempts,retry_next_at,retry_last_at,retry_exhausted_at')
    .eq('status', 'error').is('retry_exhausted_at', null)
    .not('retry_payload', 'is', null)
    // Filtrer avant le LIMIT évite que 50 retries non encore dus bloquent les suivants.
    .or(`retry_next_at.is.null,retry_next_at.lte.${nowIso}`)
    .order('created_at', { ascending: true }).limit(limit);
  if (error) throw error;

  const result = { sent: 0, failed: 0, skipped: 0, review: 0 };
  for (const row of rows || []) {
    // Après un crash durant un envoi réservé, ne pas reprendre sans vérifier Resend.
    if (!row.retry_next_at && row.retry_last_at) { result.review++; continue; }
    const attempts = Number(row.retry_attempts || 0);
    if (attempts >= MAX_RETRY_ATTEMPTS || !validPayload(row.retry_payload) || !initialDeliveryIsSafelyRetryable(row)) {
      const reason = attempts >= MAX_RETRY_ATTEMPTS ? 'nombre maximal de tentatives atteint'
        : !validPayload(row.retry_payload) ? 'contenu email invalide'
          : 'échec initial sans preuve de refus explicite Resend';
      await suppressRow(supabase, row, nowIso, reason);
      result.review++;
      continue;
    }
    if (await wasSentLater(supabase, row)) {
      await suppressRow(supabase, row, nowIso, 'email équivalent envoyé ensuite');
      result.skipped++;
      continue;
    }
    const relevance = await checkCurrentRelevance(supabase, row);
    if (!relevance.allowed) {
      await suppressRow(supabase, row, nowIso, relevance.reason);
      result.skipped++;
      continue;
    }

    const claim = await claimRow(supabase, row, nowIso);
    if (!claim) { result.skipped++; continue; } // Un autre worker a réservé la tentative.

    // Relecture après le verrou : une réservation peut avoir évolué pendant la sélection.
    // Le contrôle et le POST Resend ne sont pas atomiques avec une mutation métier.
    const fresh = await checkCurrentRelevance(supabase, row);
    if (!fresh.allowed || await wasSentLater(supabase, row)) {
      await finishClaim(supabase, claim, {
        retry_next_at: null, retry_exhausted_at: nowIso,
        error_message: manualMessage(!fresh.allowed ? fresh.reason : 'email équivalent envoyé ensuite'),
      });
      result.skipped++;
      continue;
    }

    const response = await sendEmail(row.retry_payload, { idempotencyKey: `lmv-email-retry/${row.id}` });
    if (response.ok) {
      const data = await response.json().catch(() => null);
      await finishClaim(supabase, claim, {
        status: 'sent', provider_id: data?.id || null, sent_at: nowIso,
        error_message: null, retry_next_at: null, retry_exhausted_at: null,
      });
      result.sent++;
      continue;
    }

    const errorText = String(await response.text()).slice(0, 700);
    const status = Number(response.status || 0);
    // Resend retient les clés 24 h. En l'absence d'accusé de réception
    // ou après une erreur serveur, une nouvelle tentative ultérieure pourrait
    // constituer un second envoi : revue humaine, jamais retry automatique.
    const definiteRejection = status === 429;
    const exhausted = !definiteRejection || claim.attempts >= MAX_RETRY_ATTEMPTS;
    await finishClaim(supabase, claim, {
      error_message: exhausted ? manualMessage(`réponse Resend ${status || 'inconnue'} : ${errorText}`) : errorText,
      retry_next_at: exhausted ? null : nextRetryAt(claim.attempts, now),
      retry_exhausted_at: exhausted ? nowIso : null,
    });
    if (exhausted) result.review++;
    else result.failed++;
  }
  return result;
}
