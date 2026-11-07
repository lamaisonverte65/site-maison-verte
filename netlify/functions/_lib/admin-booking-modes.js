// R30 — Formalise les modes de paiement des réservations créées depuis l’admin.
// Les montants encaissés ne sont JAMAIS inférés de la sélection « espèces ».
export function adminBookingPaymentMode(bookingKind, requestedMethod = "stripe") {
  if (bookingKind === "personal") return "none";
  if (bookingKind === "booking" || bookingKind === "airbnb") return "platform";
  if (bookingKind === "site") return requestedMethod === "cash" ? "cash" : "stripe";
  throw new Error("Type de réservation invalide.");
}

export function adminBookingPaymentState({ bookingKind, paymentMethod, total, sendPaymentLink }) {
  const method = adminBookingPaymentMode(bookingKind, paymentMethod);
  const checkout = method === "stripe" && total > 0 && sendPaymentLink === true;
  return {
    method,
    checkout,
    // Espèces à encaisser = réservation confirmée, PAS payée.
    status: method === "cash" ? "confirmed" : checkout ? "accepted" : method === "stripe" ? "pending" : "confirmed",
    paymentStatus: method === "cash" ? "cash_pending" : checkout ? "pending" : method === "stripe" ? "unpaid" : "not_required",
    depositStatus: checkout ? "à payer" : "non applicable",
    balanceStatus: checkout ? "en attente" : "non applicable",
  };
}
