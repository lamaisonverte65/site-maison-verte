import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  schedule: "0 8 * * *",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function getStep(booking, days) {
  if (days <= 10 && !booking.balance_alert_sent_at) return "urgent";
  if (days <= 17 && !booking.balance_reminder_2_sent_at) return "reminder_2";
  if (days <= 23 && !booking.balance_reminder_1_sent_at) return "reminder_1";
  if (days <= 30 && !booking.balance_requested_at) return "request";
  return null;
}

async function createSession(booking, amount) {
  return await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: booking.guest_email,
    metadata: {
      booking_id: booking.id,
      payment_type: "balance",
      balance_amount: String(amount),
      guest_first_name: booking.guest_first_name || "",
      guest_last_name: booking.guest_last_name || "",
      start_date: booking.start_date || "",
      end_date: booking.end_date || "",
    },
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: "Solde séjour - La Maison Verte",
            description: `${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}`,
          },
          unit_amount: Math.round(Number(amount) * 100),
        },
        quantity: 1,
      },
    ],
    success_url: "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://lamaisonverte65.fr/cancel",
  });
}

async function sendEmail(booking, paymentLink, amount, step) {
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
      <h2>${labels[step]} — La Maison Verte</h2>
      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>
      <p>${intro[step]}</p>
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
      ${step === "urgent" ? "<p><strong>Sans règlement ou prise de contact, la réservation pourra être annulée selon les conditions de location.</strong></p>" : ""}
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
      subject: `${labels[step]} - La Maison Verte`,
      html,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
}

export async function handler() {
  try {
    const { data: bookings, error } = await supabase
      .from("booking_requests")
      .select("*")
      .in("status", ["deposit_paid", "paid"])
      .neq("balance_status", "paid");

    if (error) throw error;

    const processed = [];

    for (const booking of bookings || []) {
      const days = daysUntil(booking.start_date);
      if (days < 0 || days > 30) continue;

      const step = getStep(booking, days);
      if (!step) continue;

      const total = Number(booking.owner_price || booking.estimated_total || 0);
      const alreadyPaid = Number(booking.amount_paid || booking.deposit_amount || 0);
      const balance = Number(booking.balance_amount || Math.max(total - alreadyPaid, 0));
      if (!balance || balance <= 0) continue;

      const session = await createSession(booking, balance);
      await sendEmail(booking, session.url, balance, step);

      const now = new Date().toISOString();
      const updatePayload = {
        balance_amount: balance,
        balance_payment_link: session.url,
        balance_status: step === "request" ? "à payer" : step,
        updated_at: now,
      };

      if (step === "request") updatePayload.balance_requested_at = now;
      if (step === "reminder_1") updatePayload.balance_reminder_1_sent_at = now;
      if (step === "reminder_2") updatePayload.balance_reminder_2_sent_at = now;
      if (step === "urgent") updatePayload.balance_alert_sent_at = now;

      const { error: updateError } = await supabase.from("booking_requests").update(updatePayload).eq("id", booking.id);
      if (updateError) throw updateError;

      processed.push({ bookingId: booking.id, step, balance });
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, processed }) };
  } catch (error) {
    console.error("Erreur check-balance-payments:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
