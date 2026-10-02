import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { verifyBalanceToken } from "./_lib/balance-link.js";
import { contractualTotal, recordedPaidAmount } from "./_lib/booking-financial-authority.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SITE_URL = process.env.URL || "https://lamaisonverte65.fr";
const STOP_STATUSES = ["cancelled", "refused", "expired"];
const PAID_STATUSES = ["fully_paid", "confirmed"];

function normalize(value) { return String(value || "").trim().toLowerCase(); }
function totalDue(b) { return contractualTotal(b); }
function totalPaid(b) { return recordedPaidAmount(b); }
function page(title, message) {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:Arial,sans-serif;background:#f6f7f3;color:#1f2933;margin:0"><main style="max-width:680px;margin:8vh auto;background:white;padding:32px;border-radius:20px"><h1>${title}</h1><p style="line-height:1.6">${message}</p><p><a href="${SITE_URL}" style="color:#166534">Retour à La Maison Verte</a></p></main></body></html>`;
}

export async function handler(event) {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const bookingId = event.queryStringParameters?.booking;
    const token = event.queryStringParameters?.token;
    if (!bookingId || !verifyBalanceToken(bookingId, token)) {
      return { statusCode: 403, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page("Lien invalide", "Ce lien de paiement n’est pas valide. Contactez-nous si vous avez besoin d’aide.") };
    }
    const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", bookingId).single();
    if (error || !booking) return { statusCode: 404, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page("Réservation introuvable", "Nous ne retrouvons pas cette réservation. Contactez-nous si nécessaire.") };
    if (STOP_STATUSES.includes(normalize(booking.status))) return { statusCode: 409, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page("Paiement indisponible", "Cette réservation n’est plus payable.") };
    const total = totalDue(booking);
    const paid = totalPaid(booking);
    const balance = Math.max(total - paid, 0);
    if (PAID_STATUSES.includes(normalize(booking.status)) || normalize(booking.balance_status) === "paid" || balance <= 0) {
      return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page("Séjour déjà réglé", "Merci, le séjour est déjà entièrement payé. Aucun nouveau paiement n’est nécessaire.") };
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], mode: "payment", customer_email: booking.guest_email,
      metadata: { booking_id: booking.id, payment_type: "balance", balance_amount: String(balance), guest_first_name: booking.guest_first_name || "", guest_last_name: booking.guest_last_name || "", start_date: booking.start_date || "", end_date: booking.end_date || "" },
      line_items: [{ price_data: { currency: "eur", product_data: { name: "Solde séjour - La Maison Verte" }, unit_amount: Math.round(balance * 100) }, quantity: 1 }],
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cancel`,
    }, { idempotencyKey: `balance-${booking.id}-${Math.round(balance * 100)}-${Math.floor(Date.now() / 300000)}` });
    return { statusCode: 303, headers: { Location: session.url, "Cache-Control": "no-store" }, body: "" };
  } catch (error) {
    console.error("Erreur pay-balance:", error);
    return { statusCode: 500, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page("Paiement momentanément indisponible", "Le paiement n’a pas pu être ouvert. Réessayez dans quelques instants ou contactez-nous.") };
  }
}
