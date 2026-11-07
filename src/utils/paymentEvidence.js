// Pure, read-only Stripe reference matching. A payer's name/email is never used
// to associate a transaction with a booking: they may be different people.
const valid = (value) => value !== null && value !== undefined && String(value).trim() !== "";

export function linkedStripeTransactions(booking, payments = [], transactions = []) {
  if (!booking?.id) return [];
  const bookingPayments = payments.filter((payment) => payment.booking_request_id === booking.id);
  const paymentIds = new Set(bookingPayments.map((payment) => String(payment.id)).filter(Boolean));
  const intentIds = new Set([
    booking.stripe_payment_intent_id,
    booking.stripe_payment_intent,
    ...bookingPayments.map((payment) => payment.stripe_payment_intent_id),
  ].filter(valid).map(String));
  return transactions.filter((transaction) => {
    // A contradictory explicit booking reference always wins over weaker IDs.
    if (valid(transaction.booking_request_id)) return String(transaction.booking_request_id) === String(booking.id);
    if (valid(transaction.payment_id) && paymentIds.has(String(transaction.payment_id))) return true;
    if (valid(transaction.payment_intent_id) && intentIds.has(String(transaction.payment_intent_id))) return true;
    return false;
  });
}

export function stripeReconciliationState(booking, payments = [], transactions = [], complete = false) {
  const linked = linkedStripeTransactions(booking, payments, transactions);
  const charges = linked.filter((transaction) => transaction.type === "charge");
  const paid = Number(booking?.amount_paid || 0) > 0 || payments.some((payment) =>
    payment.booking_request_id === booking?.id && ["paid", "partially_refunded", "refunded"].includes(payment.status));
  const payoutIds = [...new Set(linked.filter((t) => t.payout_id).map((t) => String(t.payout_id)))];
  const transferred = linked.some((transaction) => transaction.reconciliation_status === "viré");
  const pendingPayout = !transferred && payoutIds.length > 0;
  const hasStripeReference = linked.length > 0 || [booking?.stripe_payment_intent_id, booking?.stripe_checkout_session_id,
    ...payments.filter((p) => p.booking_request_id === booking?.id).flatMap((p) => [p.stripe_payment_intent_id, p.stripe_checkout_session_id])].some(valid);
  const stripeStatus = !paid ? "Non payé" : !hasStripeReference && !complete
    ? "Mode de paiement à vérifier (aucune référence Stripe)" : complete ? "Net Stripe calculé" : charges.length
      ? "Net Stripe incomplet (transactions liées)" : "Paiement enregistré, transactions Stripe non retrouvées";
  const transferStatus = !paid ? "Non payé" : !hasStripeReference && !complete
    ? "Mode de paiement à vérifier" : transferred ? "Virement Stripe rapproché" :
      pendingPayout ? "Virement Stripe en cours" : "Virement Stripe non rapproché";
  return { linked, charges, payoutIds, transferred, hasStripeReference, stripeStatus, transferStatus };
}
