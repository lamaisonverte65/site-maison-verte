import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { sendAdditionalChargeEmail } from "./_lib/additional-charge-email.js";
import { appendGuestLanguage } from "../../shared/guestLocale.js";
import { openSpecialPaymentCheckout, SpecialPaymentCheckoutError } from "./_lib/special-payment-checkout.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const dateFr = (value) => value ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(`${String(value).slice(0,10)}T12:00:00Z`)) : "—";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  try {
    const body = JSON.parse(event.body || "{}");
    const chargeId = String(body.chargeId || "").trim();
    if (!chargeId || Object.keys(body).some((key) => key !== "chargeId")) {
      return json(400, { error: "chargeId est le seul paramètre autorisé." });
    }

    const { data: charge, error: chargeError } = await supabase.from("booking_additional_charges").select("*").eq("id", chargeId).maybeSingle();
    if (chargeError) throw chargeError;
    if (!charge) return json(404, { error: "Demande complémentaire introuvable." });
    if (!["draft", "payment_requested"].includes(charge.status)) return json(409, { error: "Cette demande n'est plus payable." });

    const { data: booking, error: bookingError } = await supabase.from("booking_requests")
      .select("id,start_date,end_date,guest_first_name,guest_last_name,guest_email,communication_language")
      .eq("id", charge.booking_request_id).maybeSingle();
    if (bookingError) throw bookingError;
    if (!booking) return json(404, { error: "Réservation introuvable." });
    const guestEmail = String(booking.guest_email || "").trim();
    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return json(409, { error: "Aucune adresse email client n’est renseignée pour cette réservation." });
    }

    const result = await openSpecialPaymentCheckout({
      kind: "additional_charge", record: charge, booking, stripe, supabase,
      createParameters: () => ({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: guestEmail,
        metadata: {
          booking_id: booking.id,
          payment_type: "manual",
          manual_reason: "additional_charge",
          additional_charge_id: charge.id,
          additional_charge_category: charge.category,
          additional_charge_reason: charge.reason_label,
          manual_amount: String(charge.amount),
        },
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: `${charge.reason_label} - La Maison Verte`,
              description: `${dateFr(booking.start_date)} → ${dateFr(booking.end_date)}`,
            },
            unit_amount: Math.round(Number(charge.amount) * 100),
          },
          quantity: 1,
        }],
        success_url: appendGuestLanguage("https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}", booking.communication_language),
        cancel_url: appendGuestLanguage("https://lamaisonverte65.fr/cancel", booking.communication_language),
      }),
      sendEmail: ({ record: currentCharge, booking: currentBooking, session }) =>
        sendAdditionalChargeEmail({
          booking: currentBooking, charge: currentCharge, paymentLink: session.url, supabase,
          idempotencyKey: `lmv:additional:${currentCharge.id}:${session.id}`,
        }),
    });
    const emailResult = result.emailResult;
    const updated = result.record;
    const session = result.session;
    await supabase.from("booking_events").insert([{
      booking_request_id: booking.id,
      event_type: "additional_charge_payment_requested",
      label: "Paiement complémentaire demandé",
      message: `${updated.reason_label} — ${Number(updated.amount).toFixed(2)} €`,
      metadata: { additionalChargeId: updated.id, category: updated.category, amount: Number(updated.amount), sessionId: session.id, reused: result.reused },
    }]);

    return json(emailResult.sent ? 200 : 202, {
      ok: true,
      charge: updated,
      url: session.url,
      sessionId: session.id,
      notificationPending: !emailResult.sent,
      reused: result.reused,
    });
  } catch (error) {
    if (error instanceof SpecialPaymentCheckoutError) return json(error.statusCode, { error: error.message });
    console.error("Erreur create-additional-charge-session:", error);
    return json(500, { error: "Impossible de créer le paiement complémentaire." });
  }
}
