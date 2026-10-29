// R25 : états autorisés pour les décisions manuelles et les emails associés.
// Ces contrôles protègent des fiches périmées ; ils ne changent pas les
// transitions automatiques gérées par le webhook Stripe.
const EMAIL_DECISION_STATUSES = Object.freeze({
  accepted: "accepted",
  refused: "refused",
  confirmed: "confirmed",
});

const MANUAL_TRANSITIONS = Object.freeze({
  refused: { from: "pending", to: "refused" },
  confirmed: { from: "accepted", to: "confirmed" },
});

export function isKnownBookingDecision(type) {
  return Object.prototype.hasOwnProperty.call(EMAIL_DECISION_STATUSES, type);
}

export function isCurrentBookingDecision(type, booking, initialBooking = null) {
  if (!isKnownBookingDecision(type) || !booking || booking.status !== EMAIL_DECISION_STATUSES[type]) return false;
  if (!initialBooking) return true;
  if (booking.id !== initialBooking.id || booking.guest_email !== initialBooking.guest_email ||
    booking.updated_at !== initialBooking.updated_at) return false;
  if (type === "accepted" && (
    booking.payment_link !== initialBooking.payment_link ||
    booking.stripe_checkout_session_id !== initialBooking.stripe_checkout_session_id
  )) return false;
  return true;
}

export async function isDecisionStillCurrent(supabase, type, initialBooking) {
  if (!isCurrentBookingDecision(type, initialBooking)) return false;
  const { data, error } = await supabase.from("booking_requests")
    .select("id,status,guest_email,payment_link,stripe_checkout_session_id,updated_at")
    .eq("id", initialBooking.id)
    .maybeSingle();
  if (error) throw error; // En cas d'erreur de lecture, ne jamais envoyer l'email.
  return isCurrentBookingDecision(type, data, initialBooking);
}

export async function applyManualBookingDecision(supabase, request, type, now = new Date()) {
  const transition = MANUAL_TRANSITIONS[type];
  if (!transition) throw new Error("Action de réservation inconnue.");
  if (!request?.id || request.status !== transition.from) {
    throw new Error("Le statut de cette réservation ne permet plus cette action. Actualisez la fiche.");
  }

  const instant = now.toISOString();
  const updates = type === "refused"
    ? { status: transition.to, refused_at: instant, updated_at: instant }
    : {
        status: transition.to,
        payment_status: request.payment_status || "manual_confirmed",
        confirmed_at: instant,
        updated_at: instant,
      };
  // CAS : si Stripe ou un autre administrateur a modifié le statut depuis
  // l'ouverture du formulaire, aucune ligne ne doit être écrasée.
  const { data, error } = await supabase.from("booking_requests")
    .update(updates)
    .eq("id", request.id)
    .eq("status", transition.from)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error("Réservation modifiée entre-temps : action interrompue. Actualisez la fiche.");
  }
  return data;
}
