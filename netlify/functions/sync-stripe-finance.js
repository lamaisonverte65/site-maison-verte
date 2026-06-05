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

async function getFinancialDetails(paymentIntentId) {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });

  const charge = paymentIntent.latest_charge;
  const balanceTransaction = charge?.balance_transaction;

  if (!balanceTransaction || typeof balanceTransaction !== "object") {
    return null;
  }

  let payout = null;
  const payoutId = typeof balanceTransaction.payout === "string"
    ? balanceTransaction.payout
    : balanceTransaction.payout?.id || null;

  if (payoutId) {
    try {
      payout = await stripe.payouts.retrieve(payoutId);
    } catch (error) {
      console.error("Impossible de récupérer le payout Stripe:", payoutId, error.message);
    }
  }

  return {
    stripeFeeAmount: centsToEuros(balanceTransaction.fee),
    stripeNetAmount: centsToEuros(balanceTransaction.net),
    stripeGrossAmount: centsToEuros(balanceTransaction.amount),
    stripePayoutId: payout?.id || payoutId || null,
    stripePayoutStatus: payout?.status || null,
    stripePayoutArrivalDate: stripeTimestampToIso(payout?.arrival_date || null),
  };
}

async function runSync() {
  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("id,stripe_payment_intent_id,stripe_fee_amount,stripe_net_amount,stripe_payout_id")
    .not("stripe_payment_intent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const results = [];

  for (const booking of bookings || []) {
    try {
      const details = await getFinancialDetails(booking.stripe_payment_intent_id);

      if (!details) {
        results.push({ id: booking.id, status: "skipped", reason: "no_balance_transaction" });
        continue;
      }

      const updatePayload = {
        stripe_fee_amount: details.stripeFeeAmount,
        stripe_net_amount: details.stripeNetAmount,
        commission_amount: details.stripeFeeAmount,
        owner_net_amount: details.stripeNetAmount,
        updated_at: new Date().toISOString(),
      };

      if (details.stripePayoutId) {
        updatePayload.stripe_payout_id = details.stripePayoutId;
        updatePayload.stripe_payout_status = details.stripePayoutStatus || "paid";
        updatePayload.stripe_payout_arrival_date = details.stripePayoutArrivalDate;
        updatePayload.transfer_date = details.stripePayoutArrivalDate;
      }

      const { error: updateError } = await supabase
        .from("booking_requests")
        .update(updatePayload)
        .eq("id", booking.id);

      if (updateError) throw updateError;

      results.push({ id: booking.id, status: "updated", ...updatePayload });
    } catch (error) {
      console.error("Erreur sync Stripe réservation:", booking.id, error.message);
      results.push({ id: booking.id, status: "error", error: error.message });
    }
  }

  return results;
}

export const handler = schedule("15 7 * * *", async () => {
  try {
    const results = await runSync();
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, processed: results.length, results }),
    };
  } catch (error) {
    console.error("Erreur sync-stripe-finance:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
});
