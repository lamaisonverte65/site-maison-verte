export async function expireOpenCheckoutSession(stripe, sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return false;

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(id);
  } catch (error) {
    if (error?.code === "resource_missing") return false;
    throw error;
  }

  if (session?.status !== "open") return false;
  await stripe.checkout.sessions.expire(id);
  return true;
}

export async function expireBookingOpenCheckoutSessions(stripe, booking = {}) {
  const ids = [...new Set([
    booking.stripe_checkout_session_id,
    booking.balance_payment_stripe_session_id,
    booking.manual_payment_stripe_session_id,
  ].filter(Boolean))];

  for (const id of ids) {
    await expireOpenCheckoutSession(stripe, id);
  }
}
