import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  schedule: "0 8 * * *",
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STOP_STATUSES = ["cancelled", "refused", "expired", "fully_paid", "confirmed"];
const STOP_BALANCE_STATUSES = ["paid", "remboursé", "rembourse", "annulé", "annule", "cancelled"];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function daysUntil(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getTotalDue(booking) {
  return Number(booking.owner_price || booking.estimated_total || 0);
}

function getTotalPaid(booking) {
  const storedPaid = Number(booking.amount_paid || booking.total_paid || 0);

  if (storedPaid > 0) return storedPaid;

  const total = getTotalDue(booking);
  const deposit = Number(booking.deposit_amount || Math.round(total * 0.3) || 0);
  const manualPaid =
    normalizeStatus(booking.manual_payment_status) === "paid"
      ? Number(booking.manual_payment_amount || 0)
      : 0;

  let derived = manualPaid;

  if (normalizeStatus(booking.deposit_status) === "paid") {
    derived += deposit;
  }

  if (
    normalizeStatus(booking.balance_status) === "paid" ||
    ["fully_paid", "confirmed"].includes(booking.status)
  ) {
    return total;
  }

  return derived;
}

function shouldStopBalanceLoop(booking) {
  const total = getTotalDue(booking);
  const totalPaid = getTotalPaid(booking);
  const balanceStatus = normalizeStatus(booking.balance_status);

  if (!booking.start_date) return { stop: true, reason: "missing_start_date" };
  if (!booking.guest_email) return { stop: true, reason: "missing_guest_email" };
  if (STOP_STATUSES.includes(booking.status)) return { stop: true, reason: "booking_status_stop" };
  if (STOP_BALANCE_STATUSES.includes(balanceStatus)) return { stop: true, reason: "balance_status_stop" };
  if (total > 0 && totalPaid >= total) return { stop: true, reason: "already_fully_paid", total, totalPaid };

  return { stop: false, total, totalPaid };
}

function getStep(booking, days) {
  // Important : l’ordre va du plus urgent au moins urgent.
  // Chaque étape vérifie aussi son champ *_sent_at pour éviter tout double envoi.
  if (days <= 10 && !booking.balance_alert_sent_at) return "urgent";
  if (days <= 17 && !booking.balance_reminder_2_sent_at) return "reminder_2";
  if (days <= 23 && !booking.balance_reminder_1_sent_at) return "reminder_1";
  if (days <= 30 && !booking.balance_requested_at) return "request";
  return null;
}

async function markFullyPaidIfNeeded(booking, total, totalPaid) {
  if (!total || totalPaid < total) return false;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("booking_requests")
    .update({
      status: "fully_paid",
      payment_status: "paid",
      balance_status: "paid",
      balance_paid_at: booking.balance_paid_at || now,
      amount_paid: totalPaid,
      updated_at: now,
    })
    .eq("id", booking.id);

  if (error) throw error;
  return true;
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
    urgent:
      "Le solde de votre séjour reste à régler. Merci de procéder au paiement rapidement ou de nous contacter.",
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
      ${
        step === "urgent"
          ? "<p><strong>Sans règlement ou prise de contact, la réservation pourra être annulée selon les conditions de location.</strong></p>"
          : ""
      }
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
      .in("status", ["deposit_paid", "paid"]);

    if (error) throw error;

    const processed = [];
    const skipped = [];

    for (const booking of bookings || []) {
      const stopCheck = shouldStopBalanceLoop(booking);

      if (stopCheck.stop) {
        if (stopCheck.reason === "already_fully_paid") {
          await markFullyPaidIfNeeded(booking, stopCheck.total, stopCheck.totalPaid);
        }

        skipped.push({ bookingId: booking.id, reason: stopCheck.reason });
        continue;
      }

      const days = daysUntil(booking.start_date);
      if (days < 0 || days > 30) {
        skipped.push({ bookingId: booking.id, reason: "outside_balance_window", days });
        continue;
      }

      const step = getStep(booking, days);
      if (!step) {
        skipped.push({ bookingId: booking.id, reason: "no_step_to_send", days });
        continue;
      }

      const total = stopCheck.total;
      const totalPaid = stopCheck.totalPaid;
      const balance = Math.max(total - totalPaid, 0);

      if (!balance || balance <= 0) {
        await markFullyPaidIfNeeded(booking, total, totalPaid);
        skipped.push({ bookingId: booking.id, reason: "no_balance_left" });
        continue;
      }

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

      const { error: updateError } = await supabase
        .from("booking_requests")
        .update(updatePayload)
        .eq("id", booking.id);

      if (updateError) throw updateError;

      processed.push({ bookingId: booking.id, step, balance, days });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, processed, skipped }),
    };
  } catch (error) {
    console.error("Erreur check-balance-payments:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
