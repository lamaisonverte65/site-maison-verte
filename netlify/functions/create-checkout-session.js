import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const {
      bookingId,
      guestFirstName,
      guestLastName,
      guestEmail,
      startDate,
      endDate,
      ownerPrice,
    } = data;

    const totalPrice = Number(ownerPrice || 0);

    if (!totalPrice || totalPrice <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Montant invalide",
        }),
      };
    }

    // 30% d'acompte
    const depositAmount = Math.round(totalPrice * 0.3);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      mode: "payment",

      customer_email: guestEmail,

      metadata: {
        booking_id: bookingId,
        guest_first_name: guestFirstName || "",
        guest_last_name: guestLastName || "",
        start_date: startDate || "",
        end_date: endDate || "",
      },

      line_items: [
        {
          price_data: {
            currency: "eur",

            product_data: {
              name: "Acompte réservation - La Maison Verte",
              description:
                `${startDate} → ${endDate}`,
            },

            unit_amount: depositAmount * 100,
          },

          quantity: 1,
        },
      ],

      success_url:
        "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",

      cancel_url:
        "https://lamaisonverte65.fr/cancel",
    });

    return {
      statusCode: 200,

      body: JSON.stringify({
        url: session.url,
      }),
    };
  } catch (error) {
    console.error("Stripe error:", error);

    return {
      statusCode: 500,

      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}