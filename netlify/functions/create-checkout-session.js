import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function requireAdmin(event) {
  const rawHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  const token = rawHeader.startsWith("Bearer ")
    ? rawHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      },
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      error: {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid admin session" }),
      },
    };
  }

  const allowedRaw =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    "";

  const allowedEmails = allowedRaw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedEmails.length > 0 &&
    !allowedEmails.includes(String(data.user.email || "").toLowerCase())
  ) {
    return {
      error: {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      },
    };
  }

  return { user: data.user };
}



function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const adminAuth = await requireAdmin(event);
  if (adminAuth.error) return adminAuth.error;

  try {
    const data = JSON.parse(event.body || "{}");
    const { bookingId, guestFirstName, guestLastName, guestEmail, startDate, endDate, ownerPrice } = data;

    const totalPrice = Number(ownerPrice || 0);
    if (!totalPrice || totalPrice <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Montant invalide" }) };
    }

    const arrivalInDays = daysUntil(startDate);
    const paymentType = arrivalInDays !== null && arrivalInDays <= 30 ? "full" : "deposit";
    const depositAmount = Math.round(totalPrice * 0.3);
    const amountToPay = paymentType === "full" ? totalPrice : depositAmount;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: guestEmail,
      metadata: {
        booking_id: bookingId,
        payment_type: paymentType,
        total_price: String(totalPrice),
        deposit_amount: String(depositAmount),
        balance_amount: String(Math.max(totalPrice - depositAmount, 0)),
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
              name: paymentType === "full" ? "Paiement séjour - La Maison Verte" : "Acompte réservation - La Maison Verte",
              description: `${startDate} → ${endDate}`,
            },
            unit_amount: Math.round(amountToPay * 100),
          },
          quantity: 1,
        },
      ],
      success_url: "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://lamaisonverte65.fr/cancel",
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url, paymentType, amount: amountToPay }) };
  } catch (error) {
    console.error("Stripe error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
