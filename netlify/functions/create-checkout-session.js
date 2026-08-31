import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { createInitialCheckout, InitialCheckoutError } from "./_lib/initial-checkout.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function repositoryFor(client) {
  return {
    async getBooking(bookingId) {
      const { data, error } = await client
        .from("booking_requests")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();
      if (error) {
        throw new InitialCheckoutError("supabase_read_error", `Lecture Supabase impossible : ${error.message}`, 500);
      }
      return data;
    },

    async saveCurrentSession({ bookingId, expectedStatus, expectedUpdatedAt, values }) {
      let query = client
        .from("booking_requests")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", bookingId)
        .eq("status", expectedStatus);
      if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);

      const { data, error } = await query.select("*").maybeSingle();
      if (error) {
        throw new InitialCheckoutError("supabase_write_error", `Enregistrement Supabase impossible : ${error.message}`, 500);
      }
      if (!data) {
        throw new InitialCheckoutError(
          "booking_changed_concurrently",
          "La réservation a changé pendant la création du paiement. Rechargez la page.",
          409,
        );
      }
      return data;
    },
  };
}

const stripeGateway = {
  async createSession(parameters, options) {
    try {
      return await stripe.checkout.sessions.create(parameters, options);
    } catch (error) {
      throw new InitialCheckoutError("stripe_create_error", `Création Stripe impossible : ${error.message}`, 502);
    }
  },

  async retrieveSession(sessionId) {
    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      if (error?.code === "resource_missing") return null;
      throw new InitialCheckoutError("stripe_retrieve_error", `Lecture Stripe impossible : ${error.message}`, 502);
    }
  },
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const adminAuth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePayments, ADMIN_PERMISSIONS.manageReservations] });
  if (!adminAuth.ok) return authorizationResponse(adminAuth);

  try {
    const { bookingId } = JSON.parse(event.body || "{}");
    const result = await createInitialCheckout({
      bookingId,
      dependencies: {
        repository: repositoryFor(supabase),
        stripeGateway,
      },
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { statusCode: 400, body: JSON.stringify({ code: "invalid_json", error: "Corps JSON invalide." }) };
    }
    if (error instanceof InitialCheckoutError) {
      console.error(`Initial Checkout ${error.code}:`, error.message);
      return { statusCode: error.statusCode, body: JSON.stringify({ code: error.code, error: error.message }) };
    }
    console.error("Initial Checkout error:", error);
    return { statusCode: 500, body: JSON.stringify({ code: "internal_error", error: "Erreur interne inattendue." }) };
  }
}
