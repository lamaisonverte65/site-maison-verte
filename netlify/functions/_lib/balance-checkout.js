import { randomUUID } from "node:crypto";
import { appendGuestLanguage } from "../../../shared/guestLocale.js";
import { expireOpenCheckoutSession } from "./stripe-checkout-session.js";
import { contractualTotal, recordedPaidAmount } from "./booking-financial-authority.js";

function isStripeCheckoutUrl(urlString, sessionId) {
  try {
    const url = new URL(urlString);
    return url.protocol === "https:"
      && (url.hostname === "checkout.stripe.com" || url.hostname.endsWith(".stripe.com"))
      && url.pathname.includes(sessionId);
  } catch { return false; }
}

// A Checkout session is reusable only when it still represents exactly the
// amount and booking protected by the webhook's current-session check.
export function isReusableBalanceSession(session, booking, cents, now = Date.now()) {
  if (!session || session.id !== booking.balance_payment_stripe_session_id
      || session.status !== "open" || session.payment_status !== "unpaid"
      || session.mode !== "payment" || session.currency !== "eur"
      || session.amount_total !== cents
      || session.metadata?.booking_id !== String(booking.id)
      || session.metadata?.payment_type !== "balance"
      || !Number.isFinite(Number(session.expires_at))
      || Number(session.expires_at) * 1000 <= now + 10_000) return false;
  return isStripeCheckoutUrl(session.url, session.id);
}

async function retrieveSession(stripe, sessionId) {
  if (!sessionId) return null;
  try { return await stripe.checkout.sessions.retrieve(sessionId); }
  catch (error) {
    if (error?.code === "resource_missing") return null;
    throw error;
  }
}

function remainingCents(booking) {
  return Math.round(Math.max(contractualTotal(booking) - recordedPaidAmount(booking), 0) * 100);
}

function isPaidOrStopped(booking) {
  const status = String(booking?.status || "").trim().toLowerCase();
  return ["cancelled", "refused", "expired", "fully_paid", "confirmed"].includes(status)
    || String(booking?.balance_status || "").toLowerCase() === "paid";
}

async function safelyExpireNewSession(stripe, sessionId) {
  try { await expireOpenCheckoutSession(stripe, sessionId); }
  catch (error) { console.error("Impossible d'expirer la nouvelle session solde non attribuée:", error); }
}

async function inspectCurrentSession(stripe, booking, cents, now) {
  const session = await retrieveSession(stripe, booking.balance_payment_stripe_session_id);
  if (session?.status === "complete" || session?.payment_status === "paid") {
    return { kind: "verifying" }; // Webhook may still be in flight: never open a second charge.
  }
  if (isReusableBalanceSession(session, booking, cents, now)) {
    return { kind: "redirect", url: session.url, reused: true };
  }
  return { kind: "replace", session };
}

// Dependencies are passed in for behavioral tests; no live Stripe/DB operations in tests.
export async function openBalanceCheckout({ stripe, supabase, booking, cents, siteUrl, now = Date.now() }) {
  const checked = await inspectCurrentSession(stripe, booking, cents, now);
  if (checked.kind !== "replace") return checked;

  // A different amount / unusable URL cannot leave an older open Checkout
  // session chargeable: the payment RPC accepts only the current session id.
  if (checked.session?.status === "open") {
    try {
      const expired = await expireOpenCheckoutSession(stripe, checked.session.id);
      if (!expired) {
        const refreshed = await retrieveSession(stripe, checked.session.id);
        if (refreshed?.status === "complete" || refreshed?.payment_status === "paid") return { kind: "verifying" };
        if (refreshed?.status === "open") throw new Error("Ancienne session solde toujours ouverte.");
      }
    }
    catch (error) {
      // Another tab may have just expired or completed it.
      const refreshed = await retrieveSession(stripe, checked.session.id);
      if (refreshed?.status === "complete" || refreshed?.payment_status === "paid") return { kind: "verifying" };
      if (refreshed?.status === "open") throw error;
    }
  }

  const balance = cents / 100;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"], mode: "payment", customer_email: booking.guest_email,
    metadata: { booking_id: booking.id, payment_type: "balance", balance_amount: String(balance), guest_first_name: booking.guest_first_name || "", guest_last_name: booking.guest_last_name || "", start_date: booking.start_date || "", end_date: booking.end_date || "" },
    line_items: [{ price_data: { currency: "eur", product_data: { name: "Solde séjour - La Maison Verte" }, unit_amount: cents }, quantity: 1 }],
    success_url: appendGuestLanguage(`${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`, booking.communication_language),
    cancel_url: appendGuestLanguage(`${siteUrl}/cancel`, booking.communication_language),
  }, { idempotencyKey: `balance:${booking.id}:${cents}:${randomUUID()}` });

  if (!session?.id || !isStripeCheckoutUrl(session.url, session.id)
      || session.status !== "open" || session.payment_status !== "unpaid") {
    if (session?.id) await safelyExpireNewSession(stripe, session.id);
    throw new Error("Session Stripe solde inexploitable.");
  }

  // Compare-and-swap: two concurrent visits must never replace each other's
  // live Checkout session. Rely on the DB row count, not just a null error.
  let query = supabase.from("booking_requests").update({
    balance_payment_stripe_session_id: session.id,
    balance_amount: balance,
    updated_at: new Date(now).toISOString(),
  }).eq("id", booking.id).eq("status", booking.status);
  query = booking.updated_at == null ? query.is("updated_at", null) : query.eq("updated_at", booking.updated_at);
  query = booking.balance_payment_stripe_session_id == null
    ? query.is("balance_payment_stripe_session_id", null)
    : query.eq("balance_payment_stripe_session_id", booking.balance_payment_stripe_session_id);

  let stored;
  try { stored = await query.select("id"); }
  catch (error) { await safelyExpireNewSession(stripe, session.id); throw error; }
  if (stored?.error) {
    await safelyExpireNewSession(stripe, session.id);
    throw stored.error;
  }
  if (stored?.data?.length === 1) return { kind: "redirect", url: session.url, reused: false };

  await safelyExpireNewSession(stripe, session.id);
  // Another tab or a webhook won the race. Never redirect to this orphan.
  const { data: latest, error } = await supabase.from("booking_requests").select("*").eq("id", booking.id).single();
  if (error || !latest || isPaidOrStopped(latest) || remainingCents(latest) <= 0) return { kind: "verifying" };
  if (remainingCents(latest) === cents) {
    const winner = await inspectCurrentSession(stripe, latest, cents, now);
    if (winner.kind !== "replace") return winner;
  }
  return { kind: "conflict" };
}
