import { escapeHtml } from "./html.js";

const fail = (error) => ({ ok: false, statusCode: 400, error });
export function validateAdminEmailRequest(input = {}) {
  const keys = Object.keys(input);
  if (keys.some((key) => key !== "bookingId") || typeof input.bookingId !== "string" || !input.bookingId.trim()) return fail("Seul bookingId est accepté.");
  return { ok: true, bookingId: input.bookingId.trim() };
}

function isStripeCheckoutLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.stripe.com", "buy.stripe.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function buildStoredManualPaymentEmail(booking = {}) {
  const to = String(booking.guest_email || "").trim().toLowerCase();
  const amount = Number(booking.manual_payment_amount || 0);
  const paymentLink = String(booking.manual_payment_link || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return fail("Destinataire de réservation invalide.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Montant enregistré invalide.");
  if (!isStripeCheckoutLink(paymentLink)) return fail("Lien Stripe enregistré invalide.");
  const firstName = escapeHtml(booking.guest_first_name);
  const lastName = escapeHtml(booking.guest_last_name);
  const reason = escapeHtml(booking.manual_payment_reason || "Paiement complémentaire");
  const message = escapeHtml(booking.manual_payment_message).replace(/\r?\n/g, "<br />");
  return {
    ok: true,
    to,
    subject: "Paiement demandé - La Maison Verte",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Paiement demandé — La Maison Verte</h2><p>Bonjour ${firstName} ${lastName},</p><p><strong>Arrivée :</strong> ${escapeHtml(booking.start_date || "-")}<br /><strong>Départ :</strong> ${escapeHtml(booking.end_date || "-")}<br /><strong>Motif :</strong> ${reason}<br /><strong>Montant à régler :</strong> ${amount.toFixed(2)} €</p>${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}<p><a href="${escapeHtml(paymentLink)}">Procéder au paiement</a></p></div>`,
  };
}
