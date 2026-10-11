import { escapeHtml } from "./html.js";
import { resendEmail } from "./resend-email.js";

const dateFr = (value) => value ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(`${String(value).slice(0,10)}T12:00:00Z`)) : "—";
const money = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));

export function buildAdditionalChargeEmail({ booking, charge, paymentLink }) {
  const name = [booking?.guest_first_name, booking?.guest_last_name].filter(Boolean).join(" ").trim() || "";
  const subject = `${charge.reason_label} à régler - La Maison Verte`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6">
    <h2>Demande de paiement complémentaire — La Maison Verte</h2>
    <p>Bonjour ${escapeHtml(name)},</p>
    <p>Cette demande concerne votre séjour à <strong>La Maison Verte à Arreau</strong>.</p>
    <p><strong>Séjour :</strong> ${escapeHtml(dateFr(booking.start_date))} → ${escapeHtml(dateFr(booking.end_date))}<br>
    <strong>Motif :</strong> ${escapeHtml(charge.reason_label)}<br>
    <strong>Montant :</strong> ${escapeHtml(money(charge.amount))}</p>
    ${charge.customer_message ? `<p><strong>Message :</strong><br>${escapeHtml(charge.customer_message).replace(/\r?\n/g, "<br>")}</p>` : ""}
    <p style="margin-top:28px"><a href="${escapeHtml(paymentLink)}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">Régler ${escapeHtml(money(charge.amount))}</a></p>
    <p style="margin-top:28px;font-size:13px;color:#666">Ce paiement est distinct du règlement contractuel initial de votre séjour. Pour toute question, vous pouvez répondre à cet email.</p>
  </div>`;
  return { subject, html };
}

export async function sendAdditionalChargeEmail({ booking, charge, paymentLink, supabase }) {
  const { subject, html } = buildAdditionalChargeEmail({ booking, charge, paymentLink });
  const retryPayload = {
    from: "La Maison Verte <contact@lamaisonverte65.fr>",
    to: [booking.guest_email],
    reply_to: "contact@lamaisonverte65.fr",
    subject,
    html,
  };
  const response = await resendEmail(retryPayload);
  let providerId = null;
  let errorMessage = null;
  if (response.ok) {
    try { providerId = (await response.json())?.id || null; } catch (_) {}
  } else {
    errorMessage = await response.text();
  }
  if (supabase) {
    const { error } = await supabase.from("email_logs").insert([{
      booking_request_id: booking.id,
      email_type: "additional_charge_payment",
      to_email: booking.guest_email,
      subject,
      status: response.ok ? "sent" : "error",
      error_message: errorMessage,
      provider_id: providerId,
      retry_payload: response.ok ? null : retryPayload,
      sent_at: new Date().toISOString(),
    }]);
    if (error) console.error("Erreur log email paiement complémentaire:", error.message);
  }
  return { sent: response.ok, error: errorMessage };
}
