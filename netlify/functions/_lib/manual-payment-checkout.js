import { randomUUID } from "node:crypto";
import { contractualTotal, hasV410FinancialSnapshot, recordedPaidAmount } from "./booking-financial-authority.js";

const PAYABLE_STATUSES = new Set(["accepted", "deposit_paid", "paid"]);
const MANUAL_REASONS = new Set(["acompte", "solde", "total", "complement"]);

const status = (value) => String(value || "").trim().toLowerCase();
const cents = (value) => Math.round(Number(value) * 100);

export class ManualCheckoutError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "ManualCheckoutError";
    this.statusCode = statusCode;
  }
}

export function validateManualPaymentRequest(booking, amount, reason) {
  if (!booking || !PAYABLE_STATUSES.has(status(booking.status))) {
    throw new ManualCheckoutError("Cette réservation n’est pas dans un état permettant de demander un paiement.");
  }
  if (!MANUAL_REASONS.has(reason)) throw new ManualCheckoutError("Motif de paiement inconnu.", 400);
  const amountCents = cents(amount);
  if (!Number.isFinite(Number(amount)) || Math.abs(Number(amount) * 100 - amountCents) > 0.00001
      || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 10_000_000) {
    throw new ManualCheckoutError("Montant invalide.", 400);
  }
  const remainingCents = cents(contractualTotal(booking) - recordedPaidAmount(booking));
  if (!Number.isSafeInteger(remainingCents) || remainingCents <= 0) {
    throw new ManualCheckoutError("Cette réservation est déjà soldée.");
  }
  if (amountCents > remainingCents) {
    throw new ManualCheckoutError("Le montant demandé dépasse le restant contractuel à encaisser.", 400);
  }
  if (reason === "total" && hasV410FinancialSnapshot(booking) && amountCents !== remainingCents) {
    throw new ManualCheckoutError("Pour un contrat V4.10, le paiement total doit correspondre au restant dû.", 400);
  }
  return amountCents;
}

function trustedCheckoutUrl(value, sessionId) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com"
      && url.pathname.includes(sessionId);
  } catch {
    return false;
  }
}

export function isPayableManualSession(session, booking, now = Date.now()) {
  if (!session || session.id !== booking?.manual_payment_stripe_session_id
      || session.status !== "open" || session.payment_status !== "unpaid"
      || session.mode !== "payment" || status(session.currency) !== "eur"
      || !trustedCheckoutUrl(session.url, session.id)
      || session.url !== booking.manual_payment_link
      || String(session.customer_email || "").trim().toLowerCase() !== String(booking.guest_email || "").trim().toLowerCase()
      || !Number.isFinite(Number(session.expires_at))
      || Number(session.expires_at) * 1000 <= now + 30_000) return false;
  const meta = session.metadata || {};
  return meta.booking_id === String(booking.id)
    && meta.payment_type === "manual"
    && meta.manual_reason === booking.manual_payment_reason
    && cents(meta.manual_amount) === cents(booking.manual_payment_amount)
    && session.amount_total === cents(booking.manual_payment_amount);
}

export async function retrieveManualSession(stripe, sessionId) {
  if (!sessionId) return null;
  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    if (error?.code === "resource_missing") return null;
    throw error; // En cas de panne Stripe, ne créer ni renvoyer de lien non vérifié.
  }
}

export async function validateStoredManualPaymentForEmail({ stripe, readBooking, bookingId, now = Date.now() }) {
  const booking = await readBooking(bookingId);
  if (!booking) throw new ManualCheckoutError("Réservation introuvable.", 404);
  validateManualPaymentRequest(booking, booking.manual_payment_amount, booking.manual_payment_reason);
  if (status(booking.manual_payment_status) !== "à payer" || !booking.manual_payment_stripe_session_id) {
    throw new ManualCheckoutError("Aucun lien de paiement manuel actif à renvoyer.");
  }
  const session = await retrieveManualSession(stripe, booking.manual_payment_stripe_session_id);
  if (session?.status === "complete" || session?.payment_status === "paid") {
    throw new ManualCheckoutError("Paiement Stripe en cours de confirmation : renvoi interdit.");
  }
  if (!isPayableManualSession(session, booking, now)) {
    throw new ManualCheckoutError("Le lien Stripe enregistré n’est plus payable.");
  }
  // Une modification DB pendant la lecture Stripe invalide le message préparé.
  const latest = await readBooking(bookingId);
  if (!latest || latest.updated_at !== booking.updated_at
      || latest.manual_payment_stripe_session_id !== booking.manual_payment_stripe_session_id
      || latest.manual_payment_link !== booking.manual_payment_link) {
    throw new ManualCheckoutError("Réservation modifiée pendant la vérification du lien.");
  }
  validateManualPaymentRequest(latest, latest.manual_payment_amount, latest.manual_payment_reason);
  if (status(latest.manual_payment_status) !== "à payer") {
    throw new ManualCheckoutError("Le lien manuel n’est plus en attente de paiement.");
  }
  return latest;
}

async function expireOpen(stripe, session) {
  if (session?.status !== "open") return;
  try {
    await stripe.checkout.sessions.expire(session.id);
  } catch (error) {
    const latest = await retrieveManualSession(stripe, session.id);
    if (latest?.status === "complete" || latest?.payment_status === "paid") {
      throw new ManualCheckoutError("Un paiement Stripe est en cours de confirmation.");
    }
    if (latest?.status === "open") throw error;
  }
}

async function discardOrphan(stripe, session) {
  if (!session?.id) return;
  try {
    await expireOpen(stripe, session);
  } catch (error) {
    console.error("Impossible d’expirer la session manuelle non attribuée :", error);
  }
}

async function saveSessionIfUnchanged(supabase, booking, patch) {
  let query = supabase.from("booking_requests").update(patch)
    .eq("id", booking.id).eq("status", booking.status);
  query = booking.updated_at == null ? query.is("updated_at", null) : query.eq("updated_at", booking.updated_at);
  query = booking.manual_payment_stripe_session_id == null
    ? query.is("manual_payment_stripe_session_id", null)
    : query.eq("manual_payment_stripe_session_id", booking.manual_payment_stripe_session_id);
  const { data, error } = await query.select("id");
  if (error) throw error;
  return Array.isArray(data) && data.length === 1;
}

// Une seule session peut gagner l'écriture conditionnelle. Une session perdante
// est expirée et n'est jamais renvoyée au navigateur ni envoyée par email.
export async function openManualPaymentCheckout({
  booking, amount, reason, message, stripe, supabase, readBooking, createParameters,
  sendEmail, now = Date.now(),
}) {
  const amountCents = validateManualPaymentRequest(booking, amount, reason);
  const oldSession = await retrieveManualSession(stripe, booking.manual_payment_stripe_session_id);
  if (oldSession?.status === "complete" || oldSession?.payment_status === "paid") {
    throw new ManualCheckoutError("Paiement Stripe précédent en cours de confirmation.");
  }
  const sameRequest = status(booking.manual_payment_status) === "à payer"
    && booking.manual_payment_reason === reason
    && cents(booking.manual_payment_amount) === amountCents
    && String(booking.manual_payment_message || "") === String(message || "");
  if (sameRequest && isPayableManualSession(oldSession, booking, now)) {
    const fresh = await validateStoredManualPaymentForEmail({ stripe, readBooking, bookingId: booking.id, now });
    if (fresh.manual_payment_stripe_session_id !== oldSession.id) {
      throw new ManualCheckoutError("La réservation a changé : actualise la fiche.");
    }
    return { reused: true, emailSent: false, url: oldSession.url, sessionId: oldSession.id, amount, reason };
  }
  await expireOpen(stripe, oldSession);

  const session = await stripe.checkout.sessions.create(createParameters(), {
    idempotencyKey: `manual:${booking.id}:${amountCents}:${randomUUID()}`,
  });
  const candidate = {
    ...booking,
    manual_payment_stripe_session_id: session?.id,
    manual_payment_link: session?.url,
    manual_payment_amount: amount,
    manual_payment_reason: reason,
  };
  if (!isPayableManualSession(session, candidate, now)) {
    await discardOrphan(stripe, session);
    throw new ManualCheckoutError("La nouvelle session Stripe n’est pas exploitable.", 502);
  }

  try {
    const saved = await saveSessionIfUnchanged(supabase, booking, {
      manual_payment_amount: amount,
      manual_payment_link: session.url,
      manual_payment_reason: reason,
      manual_payment_message: message,
      manual_payment_status: "à payer",
      manual_payment_requested_at: new Date(now).toISOString(),
      manual_payment_stripe_session_id: session.id,
      updated_at: new Date(now).toISOString(),
    });
    if (!saved) throw new ManualCheckoutError("La réservation a changé : actualise la fiche avant de recommencer.");
  } catch (error) {
    await discardOrphan(stripe, session);
    throw error;
  }

  // Vérification après écriture et auprès de Stripe avant toute expédition.
  try {
    const latest = await validateStoredManualPaymentForEmail({ stripe, readBooking, bookingId: booking.id, now });
    if (latest.manual_payment_stripe_session_id !== session.id) {
      throw new ManualCheckoutError("Le lien manuel a été remplacé avant son envoi.");
    }
    await sendEmail(latest, session);
  } catch (error) {
    // Si le mail est refusé par Resend, on conserve la session payable : l'admin
    // pourra demander un renvoi vérifié. Les conflits, eux, invalident le lien.
    if (error instanceof ManualCheckoutError) await discardOrphan(stripe, session);
    throw error;
  }
  return { reused: false, emailSent: true, url: session.url, sessionId: session.id, amount, reason };
}
