const ACCEPTANCE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEPOSIT_RATE = 0.3;
const PAID_BOOKING_STATUSES = new Set(["deposit_paid", "paid", "fully_paid", "confirmed"]);

export class InitialCheckoutError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "InitialCheckoutError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function daysUntil(dateString, now) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${dateString}T00:00:00.000Z`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function paymentDetails(booking, now) {
  const hasOwnerPrice = booking.owner_price !== null
    && booking.owner_price !== undefined
    && booking.owner_price !== "";
  const total = Number(hasOwnerPrice ? booking.owner_price : booking.estimated_total);
  if (!Number.isFinite(total) || total <= 0 || !Number.isSafeInteger(Math.round(total * 100))) {
    throw new InitialCheckoutError("invalid_booking_price", "Le tarif de la réservation est invalide.", 422);
  }

  const storedDeposit = Number(booking.deposit_amount);
  const hasStoredPaymentTerms = booking.status === "accepted"
    && booking.deposit_amount !== null
    && booking.deposit_amount !== undefined
    && Number.isFinite(storedDeposit)
    && storedDeposit >= 0;
  const fullPayment = hasStoredPaymentTerms
    ? storedDeposit === 0 || booking.deposit_status === "non applicable"
    : daysUntil(booking.start_date, now) <= 30;
  const deposit = hasStoredPaymentTerms && !fullPayment
    ? money(storedDeposit)
    : money(total * DEPOSIT_RATE);
  return {
    total: money(total),
    deposit,
    balance: money(total - deposit),
    paymentType: fullPayment ? "full" : "deposit",
    amount: fullPayment ? money(total) : deposit,
  };
}

function responseFor(session, payment, acceptanceExpiresAt, reused) {
  return {
    url: session.url,
    sessionId: session.id,
    paymentType: payment.paymentType,
    amount: payment.amount,
    totalPrice: payment.total,
    acceptanceExpiresAt,
    reused,
  };
}

function isStripeCheckoutUrl(url, sessionId) {
  if (!url || !sessionId) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && (parsed.hostname === "checkout.stripe.com" || parsed.hostname.endsWith(".stripe.com"))
      && url.includes(sessionId);
  } catch {
    return false;
  }
}

function isUsableRetrievedSession(session, expectedId, now) {
  if (!session || session.id !== expectedId || session.status !== "open") return false;
  if (!isStripeCheckoutUrl(session.url, expectedId)) return false;
  return !session.expires_at || Number(session.expires_at) * 1000 > now.getTime();
}

function validateBooking(booking, now) {
  if (!booking) {
    throw new InitialCheckoutError("booking_not_found", "Réservation introuvable.", 404);
  }

  if (Number(booking.amount_paid || 0) > 0
    || PAID_BOOKING_STATUSES.has(booking.status)
    || String(booking.payment_status || "").toLowerCase() === "paid") {
    throw new InitialCheckoutError("booking_already_paid", "Cette réservation a déjà reçu un paiement.", 409);
  }

  if (!booking.guest_email || !booking.start_date || !booking.end_date) {
    throw new InitialCheckoutError("missing_booking_data", "Les données client ou les dates de la réservation sont incomplètes.", 422);
  }

  if (!new Set(["pending", "accepted"]).has(booking.status)) {
    throw new InitialCheckoutError("booking_status_incompatible", "L’état actuel de la réservation ne permet pas ce paiement.", 409);
  }

  if (booking.status === "accepted") {
    const expiry = new Date(booking.acceptance_expires_at || "");
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= now.getTime()) {
      throw new InitialCheckoutError("acceptance_expired", "Le délai d’acceptation est dépassé.", 409);
    }
  }
}

function checkoutParameters(booking, payment) {
  return {
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: booking.guest_email,
    metadata: {
      booking_id: booking.id,
      payment_type: payment.paymentType,
      total_price: String(payment.total),
      deposit_amount: String(payment.deposit),
      balance_amount: String(payment.balance),
      guest_first_name: booking.guest_first_name || "",
      guest_last_name: booking.guest_last_name || "",
      start_date: booking.start_date,
      end_date: booking.end_date,
    },
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: {
          name: payment.paymentType === "full"
            ? "Paiement séjour - La Maison Verte"
            : "Acompte réservation - La Maison Verte",
          description: `${booking.start_date} → ${booking.end_date}`,
        },
        unit_amount: Math.round(payment.amount * 100),
      },
      quantity: 1,
    }],
    success_url: "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://lamaisonverte65.fr/cancel",
  };
}

function persistenceValues(booking, session, payment, acceptanceExpiresAt, acceptedAt) {
  const fullPayment = payment.paymentType === "full";
  return {
    status: "accepted",
    payment_link: session.url,
    stripe_checkout_session_id: session.id,
    acceptance_expires_at: acceptanceExpiresAt,
    accepted_at: acceptedAt,
    deposit_amount: fullPayment ? 0 : payment.deposit,
    balance_amount: fullPayment ? payment.total : payment.balance,
    deposit_status: fullPayment ? "non applicable" : "à payer",
    balance_status: fullPayment ? "à payer" : "en attente",
  };
}

export async function createInitialCheckout({ bookingId, now = new Date(), dependencies }) {
  if (!bookingId) {
    throw new InitialCheckoutError("missing_booking_id", "L’identifiant de réservation est obligatoire.", 400);
  }

  const { repository, stripeGateway } = dependencies;
  const booking = await repository.getBooking(bookingId);
  validateBooking(booking, now);
  const payment = paymentDetails(booking, now);

  const acceptanceExpiresAt = booking.status === "accepted"
    ? booking.acceptance_expires_at
    : new Date(now.getTime() + ACCEPTANCE_WINDOW_MS).toISOString();

  if (booking.status === "accepted"
    && isStripeCheckoutUrl(booking.payment_link, booking.stripe_checkout_session_id)) {
    return responseFor({ id: booking.stripe_checkout_session_id, url: booking.payment_link }, payment, acceptanceExpiresAt, true);
  }

  if (booking.status === "accepted" && booking.stripe_checkout_session_id) {
    const currentSession = await stripeGateway.retrieveSession(booking.stripe_checkout_session_id);
    if (isUsableRetrievedSession(currentSession, booking.stripe_checkout_session_id, now)) {
      await repository.saveCurrentSession({
        bookingId: booking.id,
        expectedStatus: booking.status,
        expectedUpdatedAt: booking.updated_at,
        values: persistenceValues(
          booking,
          currentSession,
          payment,
          acceptanceExpiresAt,
          booking.accepted_at || now.toISOString(),
        ),
      });
      return responseFor(currentSession, payment, acceptanceExpiresAt, true);
    }
  }

  const session = await stripeGateway.createSession(
    checkoutParameters(booking, payment),
    { idempotencyKey: `initial-checkout:${booking.id}:${booking.updated_at || "unversioned"}` },
  );

  if (!session?.id || !isStripeCheckoutUrl(session.url, session.id)) {
    throw new InitialCheckoutError("invalid_stripe_session", "Stripe n’a pas retourné de session de paiement exploitable.", 502);
  }

  await repository.saveCurrentSession({
    bookingId: booking.id,
    expectedStatus: booking.status,
    expectedUpdatedAt: booking.updated_at,
    values: persistenceValues(
      booking,
      session,
      payment,
      acceptanceExpiresAt,
      booking.accepted_at || now.toISOString(),
    ),
  });

  return responseFor(session, payment, acceptanceExpiresAt, false);
}
