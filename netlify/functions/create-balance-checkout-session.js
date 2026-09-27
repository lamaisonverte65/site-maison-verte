import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { createBalancePaymentUrl } from "./_lib/balance-link.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

async function sendBalanceEmail(booking, paymentLink, amount, step = "request") {
  const labels = {
    request: "Paiement du solde",
    reminder_1: "Rappel paiement du solde",
    reminder_2: "Rappel important paiement du solde",
    urgent: "Dernier rappel paiement du solde",
  };

  const intro = {
    request: "Le solde de votre séjour est maintenant à régler.",
    reminder_1: "Sauf erreur de notre part, le solde de votre séjour reste à régler.",
    reminder_2: "Nous vous rappelons que le solde de votre séjour reste à régler.",
    urgent: "Le solde de votre séjour reste à régler. Merci de procéder au paiement rapidement ou de nous contacter.",
  };

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${labels[step] || labels.request} — La Maison Verte</h2>

      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>

      <p>${intro[step] || intro.request}</p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}<br />
        <strong>Solde à payer :</strong> ${formatMoney(amount)}
      </p>

      <p style="margin-top:30px;">
        <a href="${paymentLink}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          Payer le solde
        </a>
      </p>

      ${step === "reminder_2" ? "<p>Votre réservation reste bien enregistrée et les dates restent réservées. Le solde demeure à régler. Si vous rencontrez une difficulté, avez une question ou souhaitez modifier votre projet de séjour, contactez-nous.</p>" : ""}
      ${step === "urgent" ? "<p>Votre réservation reste bien enregistrée et les dates restent réservées. Le solde demeure à régler. Il s’agit de notre dernière relance automatique ; si vous rencontrez une difficulté ou si votre projet a changé, contactez-nous.</p>" : ""}

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages,
        puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject: `${labels[step] || labels.request} - La Maison Verte`,
      html,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
}


export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const adminAuth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePayments] });
  if (!adminAuth.ok) return authorizationResponse(adminAuth);

  try {
    const { bookingId, step = "request" } = JSON.parse(event.body || "{}");
    if (!bookingId) return { statusCode: 400, body: JSON.stringify({ error: "bookingId manquant" }) };

    const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", bookingId).single();
    if (error) throw error;

    const total = Number(booking.owner_price || booking.estimated_total || 0);
    const alreadyPaid = Number(booking.amount_paid || booking.deposit_amount || 0);
    const balance = Number(booking.balance_amount || Math.max(total - alreadyPaid, 0));

    if (!balance || balance <= 0) return { statusCode: 400, body: JSON.stringify({ error: "Aucun solde à payer" }) };

    const paymentLink = createBalancePaymentUrl(process.env.URL || "https://lamaisonverte65.fr", booking.id);
    await sendBalanceEmail(booking, paymentLink, balance, step);

    const now = new Date().toISOString();
    const updatePayload = {
      balance_amount: balance,
      balance_payment_link: paymentLink,
      balance_status: step === "request" ? "à payer" : step,
      updated_at: now,
    };

    if (step === "request") updatePayload.balance_requested_at = now;
    if (step === "reminder_1") updatePayload.balance_reminder_1_sent_at = now;
    if (step === "reminder_2") updatePayload.balance_reminder_2_sent_at = now;
    if (step === "urgent") updatePayload.balance_alert_sent_at = now;

    const { error: updateError } = await supabase.from("booking_requests").update(updatePayload).eq("id", booking.id);
    if (updateError) throw updateError;

    return { statusCode: 200, body: JSON.stringify({ url: paymentLink, amount: balance, step }) };
  } catch (error) {
    console.error("Erreur create-balance-checkout-session:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
