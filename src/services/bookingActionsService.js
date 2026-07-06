async function getAdminFetchHeaders(supabase) {
  const { data: { session: currentSession } } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(currentSession?.access_token
      ? { Authorization: `Bearer ${currentSession.access_token}` }
      : {}),
  };
}

export async function createCheckoutSession(supabase, request, ownerPrice) {
  const response = await fetch("/.netlify/functions/create-checkout-session", {
    method: "POST",
    headers: await getAdminFetchHeaders(supabase),
    body: JSON.stringify({
      bookingId: request.id,
      guestFirstName: request.guest_first_name,
      guestLastName: request.guest_last_name,
      guestEmail: request.guest_email,
      startDate: request.start_date,
      endDate: request.end_date,
      ownerPrice,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
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
