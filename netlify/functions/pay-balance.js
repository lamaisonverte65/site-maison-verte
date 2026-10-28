import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { verifyBalanceToken } from "./_lib/balance-link.js";
import { appendGuestLanguage } from "../../shared/guestLocale.js";
import { contractualTotal, recordedPaidAmount } from "./_lib/booking-financial-authority.js";
import { openBalanceCheckout } from "./_lib/balance-checkout.js";

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
    const result = await openBalanceCheckout({
      stripe, supabase, booking, cents: Math.round(balance * 100), siteUrl: SITE_URL,
    });
    if (result.kind === "redirect") {
      return { statusCode: 303, headers: { Location: result.url, "Cache-Control": "no-store" }, body: "" };
    }
    if (result.kind === "verifying") {
      return { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body: page("Paiement en cours de vérification", "Un paiement peut être en cours de confirmation. Aucun nouveau paiement n'a été ouvert. Veuillez réessayer après quelques instants ou nous contacter.") };
    }
    return { statusCode: 409, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }, body: page("Lien à actualiser", "La réservation vient d'être mise à jour. Merci de rouvrir votre lien de paiement dans quelques instants.") };
  } catch (error) {
    console.error("Erreur pay-balance:", error);
    return { statusCode: 500, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page("Paiement momentanément indisponible", "Le paiement n’a pas pu être ouvert. Réessayez dans quelques instants ou contactez-nous.") };
  }
}
