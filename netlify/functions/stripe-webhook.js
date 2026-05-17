import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    const signature = event.headers["stripe-signature"];

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const bookingId = session.metadata?.booking_id;

      if (!bookingId) {
        return {
          statusCode: 400,
          body: "Missing booking_id",
        };
      }

      const { error } = await supabase
        .from("booking_requests")
        .update({
          status: "confirmed",
          payment_status: "paid",
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (error) {
        console.error(error);

        return {
          statusCode: 500,
          body: error.message,
        };
      }

      console.log("Réservation confirmée :", bookingId);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        received: true,
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 400,
      body: `Webhook Error: ${error.message}`,
    };
  }
}