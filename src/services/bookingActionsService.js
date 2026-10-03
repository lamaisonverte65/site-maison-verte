async function getAdminFetchHeaders(supabase) {
  const { data: { session: currentSession } } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(currentSession?.access_token
      ? { Authorization: `Bearer ${currentSession.access_token}` }
      : {}),
  };
}

export async function prepareInitialCheckoutBooking(supabase, request, specialAccommodation, ownerMessage) {
  const raw = specialAccommodation;
  const hasSpecial = raw !== null && raw !== undefined && String(raw).trim() !== "";
  const amount = hasSpecial ? Number(raw) : null;
  if (hasSpecial && (!Number.isFinite(amount) || amount <= 0)) {
    throw new Error("Tarif spécial d’hébergement invalide.");
  }

  const response = await fetch("/.netlify/functions/prepare-initial-checkout-booking", {
    method: "POST",
    headers: await getAdminFetchHeaders(supabase),
    body: JSON.stringify({
      bookingId: request.id,
      specialAccommodation: amount,
      ownerMessage,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function createCheckoutSession(supabase, request) {
  const response = await fetch("/.netlify/functions/create-checkout-session", {
    method: "POST",
    headers: await getAdminFetchHeaders(supabase),
    body: JSON.stringify({ bookingId: request.id }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export function buildInitialCheckoutAcceptanceContext(checkoutSession, daysBeforeArrival) {
  const totalPrice = Number(checkoutSession?.totalPrice);
  if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
    throw new Error("Le tarif serveur retourné pour le Checkout est invalide.");
  }

  return {
    totalPrice,
    emailExtras: {
      paymentLink: checkoutSession.url,
      acceptanceExpiresAt: checkoutSession.acceptanceExpiresAt,
      paymentType: checkoutSession.paymentType,
      paymentAmount: checkoutSession.amount,
      daysBeforeArrival,
    },
    eventMessage: `Lien de paiement envoyé. Tarif proposé : ${totalPrice} €`,
    eventMetadata: {
      price: totalPrice,
      paymentLink: checkoutSession.url,
      paymentType: checkoutSession.paymentType,
    },
  };
}

export async function sendDecisionEmail(supabase, request, type, ownerMessage) {
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  const response = await fetch("/.netlify/functions/send-booking-decision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
    },
    body: JSON.stringify({
      bookingId: request.id,
      type,
      ownerMessage,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function createManualPayment(supabase, request, amount, reason, message) {
  const response = await fetch("/.netlify/functions/create-manual-payment-session", {
    method: "POST",
    headers: await getAdminFetchHeaders(supabase),
    body: JSON.stringify({
      bookingId: request.id,
      amount,
      reason,
      message,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function refundBookingPayment(supabase, request, values) {
  const response = await fetch("/.netlify/functions/refund-booking-payment", {
    method: "POST",
    headers: await getAdminFetchHeaders(supabase),
    body: JSON.stringify({
      operationId: values.operationId,
      bookingId: request.id,
      action: values.action || "cancel_refund",
      refundOnly: values.refundOnly || false,
      cancellationType: values.cancellationType,
      refundMode: values.refundMode,
      refundAmount: values.refundAmount,
      message: values.message,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export function createRefundOperationId(randomUUID = () => globalThis.crypto.randomUUID()) {
  const operationId = randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    throw new Error("Impossible de creer un identifiant de remboursement valide.");
  }
  return operationId;
}

export function buildRefundSubmission(modal, values, overrides = {}) {
  if (!modal?.refundOperationId) throw new Error("Identifiant de remboursement manquant.");
  return { ...values, ...overrides, operationId: modal.refundOperationId };
}

export async function logBookingEvent(supabase, bookingId, eventType, label, message, metadata = {}) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: eventType,
    label,
    message,
    metadata,
  }]);
  if (error) console.error("Erreur historique action :", error.message);
}
