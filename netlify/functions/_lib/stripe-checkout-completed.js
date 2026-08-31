import { randomBytes } from "node:crypto";
import { hashArrivalToken } from "./arrival-token.js";

function getCheckoutAmount(session) {
  if (typeof session?.amount_total === "number") return session.amount_total / 100;
  return Number(session?.metadata?.manual_amount || session?.metadata?.balance_amount || session?.metadata?.deposit_amount || 0);
}

function createArrivalCapability() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashArrivalToken(token) };
}

function stripeTimestampToIso(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || numericTimestamp <= 0) {
    throw new Error("Horodatage Stripe checkout.session.completed invalide.");
  }
  return new Date(numericTimestamp * 1000).toISOString();
}

export async function processCheckoutSessionCompleted({ session, stripeEventCreated, dependencies }) {
  const bookingId = session?.metadata?.booking_id;
  if (!bookingId) throw new Error("Missing booking_id");
  if (!session?.id) throw new Error("Missing checkout_session_id");

  const paymentType = session.metadata?.payment_type || "deposit";
  const manualReason = session.metadata?.manual_reason || "complement";
  const amount = getCheckoutAmount(session);
  const stripePaidAt = stripeTimestampToIso(stripeEventCreated);
  const financialDetails = await dependencies.getFinancialDetails(session);
  const arrivalCapability = (dependencies.createArrivalCapability || createArrivalCapability)();

  const application = await dependencies.applyPayment({
    bookingId,
    checkoutSessionId: session.id,
    paymentIntentId: session.payment_intent || null,
    paymentType,
    manualReason: paymentType === "manual" ? manualReason : null,
    amount,
    currency: session.currency || "eur",
    customerEmail: session.customer_email || session.customer_details?.email || null,
    metadata: session.metadata || {},
    stripePaidAt,
    stripeFeeAmount: financialDetails.stripeFeeAmount,
    stripeNetAmount: financialDetails.stripeNetAmount,
    balanceTransactionId: financialDetails.stripeBalanceTransactionId,
    chargeId: financialDetails.stripeChargeId,
    arrivalTokenHash: arrivalCapability.hash,
  });

  if (application.outcome !== "applied") {
    return {
      outcome: application.outcome,
      ...(application.outcome === "review_required" ? { reviewReason: application.review_reason || null } : {}),
    };
  }

  await dependencies.sendConfirmationEmail({
    booking: application.booking,
    paymentType,
    manualReason,
    amount,
    arrivalToken: arrivalCapability.token,
  });

  return { outcome: "applied" };
}
