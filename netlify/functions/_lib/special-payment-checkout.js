import { randomUUID } from "node:crypto";

const ELIGIBLE = Object.freeze({
  cleaning: new Set(["confirmed", "payment_requested"]),
  additional_charge: new Set(["draft", "payment_requested"]),
});
const TABLE = Object.freeze({
  cleaning: "booking_cleaning_issues",
  additional_charge: "booking_additional_charges",
});

export class SpecialPaymentCheckoutError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "SpecialPaymentCheckoutError";
    this.statusCode = statusCode;
  }
}

const cents = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) {
    throw new SpecialPaymentCheckoutError("Montant de paiement invalide.");
  }
  const amount = Math.round(n * 100);
  if (!Number.isSafeInteger(amount) || amount > 10_000_000) {
    throw new SpecialPaymentCheckoutError("Montant de paiement invalide.");
  }
  return amount;
};

function safeCents(value) {
  try { return cents(value); } catch { return null; }
}

function sessionUrlMatches(value, sessionId) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "checkout.stripe.com"
      && url.pathname.includes(sessionId);
  } catch {
    return false;
  }
}

export function validSpecialPaymentSession(session, { kind, record, booking, now = Date.now() }) {
  if (!session || !record || !booking || !ELIGIBLE[kind]?.has(record.status)) return false;
  const amount = cents(kind === "cleaning" ? record.amount_due : record.amount);
  const meta = session.metadata || {};
  return session.id === record.stripe_session_id
    && session.status === "open"
    && session.payment_status === "unpaid"
    && session.mode === "payment"
    && session.currency === "eur"
    && session.amount_total === amount
    && Number.isFinite(Number(session.expires_at))
    && Number(session.expires_at) * 1000 > now + 30_000
    && sessionUrlMatches(session.url, session.id)
    && String(session.customer_email || "").trim().toLowerCase() === String(booking.guest_email || "").trim().toLowerCase()
    && meta.booking_id === String(booking.id)
    && meta.payment_type === "manual"
    && meta.manual_reason === kind
    && meta[`${kind === "cleaning" ? "cleaning_issue_id" : "additional_charge_id"}`] === String(record.id)
    && safeCents(meta.manual_amount) === amount
    && (kind === "cleaning" || session.url === record.payment_link);
}

async function retrieveSession(stripe, id) {
  if (!id) return null;
  try { return await stripe.checkout.sessions.retrieve(id); }
  catch (error) {
    if (error?.code === "resource_missing") return null;
    throw error;
  }
}

async function expireIfOpen(stripe, session) {
  if (session?.status !== "open") return;
  try { await stripe.checkout.sessions.expire(session.id); }
  catch (error) {
    const current = await retrieveSession(stripe, session.id);
    if (current?.status === "complete" || current?.payment_status === "paid") {
      throw new SpecialPaymentCheckoutError("Paiement Stripe en cours de confirmation : aucun nouveau lien autorisé.");
    }
    if (current?.status === "open") throw error;
  }
}

async function expireOrphan(stripe, session) {
  try { await expireIfOpen(stripe, session); }
  catch (error) { console.error("Session Stripe complémentaire non attribuée : expiration impossible", error); }
}

async function readRecord(supabase, kind, id) {
  const { data, error } = await supabase.from(TABLE[kind]).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function readBooking(supabase, bookingId) {
  const { data, error } = await supabase.from("booking_requests")
    .select("id,guest_email,guest_first_name,guest_last_name,start_date,end_date,communication_language")
    .eq("id", bookingId).maybeSingle();
  if (error) throw error;
  return data;
}

async function validateFreshSession({ supabase, stripe, kind, record, booking, expectedSessionId, now }) {
  const latestRecord = await readRecord(supabase, kind, record.id);
  const latestBooking = await readBooking(supabase, booking.id);
  if (!latestRecord || !latestBooking || latestRecord.stripe_session_id !== expectedSessionId
      || latestRecord.updated_at !== record.updated_at
      || latestBooking.guest_email !== booking.guest_email
      || !ELIGIBLE[kind].has(latestRecord.status)) {
    throw new SpecialPaymentCheckoutError("Le dossier a été modifié : actualise la fiche avant de renvoyer le lien.");
  }
  const session = await retrieveSession(stripe, expectedSessionId);
  if (session?.status === "complete" || session?.payment_status === "paid") {
    throw new SpecialPaymentCheckoutError("Paiement Stripe en cours de confirmation.");
  }
  if (!validSpecialPaymentSession(session, { kind, record: latestRecord, booking: latestBooking, now })) {
    throw new SpecialPaymentCheckoutError("Le lien Stripe n’est plus payable : aucun email envoyé.");
  }
  return { record: latestRecord, booking: latestBooking, session };
}

/**
 * One session per charge, with a compare-and-swap on its source row.
 * Every mail (including a deliberate resend) must use the current Stripe session.
 * No payment or DB mutation is performed in a unit test unless injected mocks do so.
 */
export async function openSpecialPaymentCheckout({
  kind, record, booking, stripe, supabase, createParameters, sendEmail, now = Date.now(),
}) {
  if (!TABLE[kind] || !ELIGIBLE[kind].has(record?.status) || !booking?.id) {
    throw new SpecialPaymentCheckoutError("Ce dossier n’est pas payable dans son état actuel.");
  }
  if (record.booking_request_id !== booking.id) {
    throw new SpecialPaymentCheckoutError("Réservation incompatible avec le dossier de paiement.");
  }
  if (!booking.guest_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.guest_email)) {
    throw new SpecialPaymentCheckoutError("Adresse email client invalide.");
  }
  const amount = cents(kind === "cleaning" ? record.amount_due : record.amount);
  const stored = await retrieveSession(stripe, record.stripe_session_id);
  if (stored?.status === "complete" || stored?.payment_status === "paid") {
    throw new SpecialPaymentCheckoutError("Paiement Stripe en cours de confirmation : aucune nouvelle demande autorisée.");
  }
  if (validSpecialPaymentSession(stored, { kind, record, booking, now })) {
    const fresh = await validateFreshSession({ supabase, stripe, kind, record, booking, expectedSessionId: stored.id, now });
    const emailResult = await sendEmail(fresh);
    return { ...fresh, reused: true, emailResult, amount: amount / 100 };
  }
  await expireIfOpen(stripe, stored);

  const created = await stripe.checkout.sessions.create(createParameters(), {
    idempotencyKey: `special:${kind}:${record.id}:${randomUUID()}`,
  });
  const patch = {
    status: "payment_requested",
    stripe_session_id: created?.id,
    payment_requested_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    ...(kind === "additional_charge" ? { payment_link: created?.url } : {}),
  };
  const candidate = { ...record, ...patch };
  if (!validSpecialPaymentSession(created, { kind, record: candidate, booking, now })) {
    await expireOrphan(stripe, created);
    throw new SpecialPaymentCheckoutError("La nouvelle session Stripe n’est pas exploitable.", 502);
  }

  try {
    let query = supabase.from(TABLE[kind]).update(patch)
      .eq("id", record.id).eq("status", record.status);
    query = record.updated_at == null ? query.is("updated_at", null) : query.eq("updated_at", record.updated_at);
    query = record.stripe_session_id == null ? query.is("stripe_session_id", null) : query.eq("stripe_session_id", record.stripe_session_id);
    const { data, error } = await query.select("*");
    if (error) throw error;
    if (!Array.isArray(data) || data.length !== 1) {
      throw new SpecialPaymentCheckoutError("Le dossier a changé pendant la création du paiement : actualise la fiche.");
    }
    // Check Stripe and reread DB after the conditional write, before releasing any link.
    const fresh = await validateFreshSession({
      supabase, stripe, kind, record: data[0], booking,
      expectedSessionId: created.id, now,
    });
    const emailResult = await sendEmail(fresh);
    return { ...fresh, reused: false, emailResult, amount: amount / 100 };
  } catch (error) {
    // Email delivery failures do not invalidate a payable Stripe link: a later
    // deliberate retry is possible, always after a fresh Stripe verification.
    if (error instanceof SpecialPaymentCheckoutError || error?.code) await expireOrphan(stripe, created);
    throw error;
  }
}
