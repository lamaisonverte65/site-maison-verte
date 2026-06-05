import { schedule } from "@netlify/functions";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function centsToEuros(value) {
  return Number(value || 0) / 100;
}

function stripeTimestampToIso(timestamp) {
  if (!timestamp) return null;
  return new Date(Number(timestamp) * 1000).toISOString();
}

function nearlyEqual(a, b, tolerance = 0.01) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
}

async function findBookingAndPaymentByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return { booking: null, payment: null };

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (payment?.booking_request_id) {
    const { data: booking } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", payment.booking_request_id)
      .maybeSingle();
    return { booking, payment };
  }

  const { data: booking } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  return { booking, payment: null };
}

async function upsertStripePayout(payout, transactions = []) {
  if (!payout?.id) return null;

  const transactionNetTotal = transactions.reduce((sum, item) => sum + centsToEuros(item.net), 0);
  const amount = centsToEuros(payout.amount);

  const payload = {
    id: payout.id,
    amount,
    currency: payout.currency || "eur",
    status: payout.status || null,
    arrival_date: stripeTimestampToIso(payout.arrival_date || null),
    created_at_stripe: stripeTimestampToIso(payout.created || null),
    reconciled_at: new Date().toISOString(),
    transaction_count: transactions.length,
    expected_net_total: transactionNetTotal,
    difference_amount: Number((amount - transactionNetTotal).toFixed(2)),
    raw: payout,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("stripe_payouts").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  return payload;
}

async function upsertStripeBalanceTransaction(transaction, payout = null) {
  if (!transaction?.id) return null;

  let paymentIntentId = null;
  let chargeId = null;
  let sourceObject = transaction.source;

  if (typeof sourceObject === "object" && sourceObject) {
    chargeId = sourceObject.id || null;
    paymentIntentId = sourceObject.payment_intent || null;
  }

  const { booking, payment } = await findBookingAndPaymentByPaymentIntent(paymentIntentId);
  const payoutStatus = payout?.status || (transaction.payout ? "paid" : null);
  const reconciliationStatus = transaction.payout
    ? (payoutStatus === "paid" ? "viré" : "payout_en_cours")
    : "en_attente_payout";

  const payload = {
    id: transaction.id,
    booking_request_id: booking?.id || payment?.booking_request_id || null,
    payment_id: payment?.id || null,
    payment_type: payment?.payment_type || null,
    payment_intent_id: paymentIntentId,
    charge_id: chargeId,
    payout_id: payout?.id || (typeof transaction.payout === "string" ? transaction.payout : transaction.payout?.id || null),
    type: transaction.type || null,
    reporting_category: transaction.reporting_category || null,
    amount: centsToEuros(transaction.amount),
    fee: centsToEuros(transaction.fee),
    net: centsToEuros(transaction.net),
    currency: transaction.currency || "eur",
    available_on: stripeTimestampToIso(transaction.available_on || null),
    created_at_stripe: stripeTimestampToIso(transaction.created || null),
    description: transaction.description || null,
    reconciliation_status: reconciliationStatus,
    raw: transaction,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("stripe_balance_transactions").upsert(payload, { onConflict: "id" });
  if (error) throw error;

  if (payload.booking_request_id && transaction.type === "charge") {
    const bookingUpdate = {
      stripe_fee_amount: payload.fee,
      stripe_net_amount: payload.net,
      commission_amount: payload.fee,
      owner_net_amount: payload.net,
      updated_at: new Date().toISOString(),
    };

    if (payload.payout_id) {
      bookingUpdate.stripe_payout_id = payload.payout_id;
      bookingUpdate.stripe_payout_status = payoutStatus || "paid";
      bookingUpdate.stripe_payout_arrival_date = stripeTimestampToIso(payout?.arrival_date || null);
      bookingUpdate.transfer_date = stripeTimestampToIso(payout?.arrival_date || null);
    }

    const { error: bookingError } = await supabase
      .from("booking_requests")
      .update(bookingUpdate)
      .eq("id", payload.booking_request_id);

    if (bookingError) throw bookingError;
  }

  return payload;
}

async function syncPaymentIntentsWithoutPayout() {
  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("id,amount_paid,stripe_payment_intent_id")
    .not("stripe_payment_intent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const results = [];

  for (const booking of bookings || []) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id, {
        expand: ["latest_charge.balance_transaction"],
      });

      const charge = paymentIntent.latest_charge;
      const balanceTransaction = charge?.balance_transaction;
      if (!balanceTransaction || typeof balanceTransaction !== "object") {
        results.push({ id: booking.id, status: "skipped", reason: "no_balance_transaction" });
        continue;
      }

      const gross = centsToEuros(balanceTransaction.amount);
      const expectedPaid = Number(booking.amount_paid || 0);
      if (expectedPaid > 0 && !nearlyEqual(gross, expectedPaid)) {
        results.push({ id: booking.id, status: "skipped", reason: "amount_mismatch", gross, expectedPaid });
        continue;
      }

      let payout = null;
      const payoutId = typeof balanceTransaction.payout === "string"
        ? balanceTransaction.payout
        : balanceTransaction.payout?.id || null;

      if (payoutId) {
        payout = await stripe.payouts.retrieve(payoutId);
        await upsertStripePayout(payout, [balanceTransaction]);
      }

      const row = await upsertStripeBalanceTransaction(balanceTransaction, payout);
      results.push({ id: booking.id, status: "synced", balanceTransaction: row?.id, payout: row?.payout_id || null });
    } catch (error) {
      console.error("Erreur sync Stripe réservation:", booking.id, error.message);
      results.push({ id: booking.id, status: "error", error: error.message });
    }
  }

  return results;
}

async function syncRecentPayouts() {
  const payouts = await stripe.payouts.list({ limit: 20 });
  const results = [];

  for (const payout of payouts.data || []) {
    const transactions = await stripe.balanceTransactions.list({
      payout: payout.id,
      limit: 100,
      expand: ["data.source"],
    });

    await upsertStripePayout(payout, transactions.data || []);

    const transactionResults = [];
    for (const transaction of transactions.data || []) {
      const row = await upsertStripeBalanceTransaction(transaction, payout);
      transactionResults.push({ id: transaction.id, bookingRequestId: row?.booking_request_id || null, net: row?.net || 0, status: row?.reconciliation_status });
    }

    results.push({ payoutId: payout.id, amount: centsToEuros(payout.amount), status: payout.status, transactions: transactionResults });
  }

  return results;
}

async function runSync() {
  const paymentIntentResults = await syncPaymentIntentsWithoutPayout();
  const payoutResults = await syncRecentPayouts();

  return {
    paymentIntents: paymentIntentResults,
    payouts: payoutResults,
  };
}

export const handler = schedule("15 7 * * *", async () => {
  try {
    const results = await runSync();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, results }),
    };
  } catch (error) {
    console.error("Erreur sync-stripe-finance:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
});
