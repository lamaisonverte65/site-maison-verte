async function getAdminFetchHeaders(supabase) {
  const { data: { session: currentSession } } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(currentSession?.access_token
      ? { Authorization: `Bearer ${currentSession.access_token}` }
      : {}),
  };
}

export async function prepareInitialCheckoutBooking(supabase, request, ownerPrice, ownerMessage) {
  const total = Number(ownerPrice);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Tarif invalide.");
  }

  const estimatedTotal = Number(request.estimated_total || 0);
  const discountAmount = Math.max(estimatedTotal - total, 0);
  const { data, error } = await supabase
    .from("booking_requests")
    .update({
      owner_price: total,
      owner_message: ownerMessage,
      discount_amount: discountAmount,
      discount_reason: discountAmount > 0 ? "Tarif spécial propriétaire" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("La réservation n’est plus en attente.");
  return data;
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

export async function sendDecisionEmail(supabase, request, type, ownerPrice, ownerMessage, extras = {}) {
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
      guestEmail: request.guest_email,
      guestFirstName: request.guest_first_name,
      guestLastName: request.guest_last_name,
      startDate: request.start_date,
      endDate: request.end_date,
      nights: request.nights,
      estimatedTotal: request.estimated_total,
      ownerPrice,
      ownerMessage,
      arrivalTime: request.arrival_time,
      adultsCount: request.adults_count,
      childrenCount: request.children_count,
      childrenAges: request.children_ages,
      babyBedNeeded: request.baby_bed_needed,
      ...extras,
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
      guestEmail: request.guest_email,
      guestFirstName: request.guest_first_name,
      guestLastName: request.guest_last_name,
      startDate: request.start_date,
      endDate: request.end_date,
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
