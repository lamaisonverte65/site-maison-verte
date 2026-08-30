import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

  const adminAuth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePayments, ADMIN_PERMISSIONS.manageReservations] });
  if (!adminAuth.ok) return authorizationResponse(adminAuth);

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
