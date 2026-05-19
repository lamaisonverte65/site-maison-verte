import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function requireAdmin(event) {
  const rawHeader =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  const token = rawHeader.startsWith("Bearer ")
    ? rawHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return {
      error: {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      },
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      error: {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid admin session" }),
      },
    };
  }

  const allowedRaw =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    "";

  const allowedEmails = allowedRaw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (
    allowedEmails.length > 0 &&
    !allowedEmails.includes(String(data.user.email || "").toLowerCase())
  ) {
    return {
      error: {
        statusCode: 403,
        body: JSON.stringify({ error: "Forbidden" }),
      },
    };
  }

  return { user: data.user };
}



async function logBookingEvent({ bookingId, eventType, label, message, metadata = {} }) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: eventType,
    label,
    message,
    metadata,
  }]);
  if (error) console.error("Erreur log booking_events:", error.message);
}

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId || null,
    email_type: emailType,
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    sent_at: new Date().toISOString(),
  }]);
  if (error) console.error("Erreur log email_logs:", error.message);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function getReasonLabel(reason) {
  const labels = {
    acompte: "Acompte",
    solde: "Solde",
    total: "Paiement total / tarif promo",
    complement: "Complément",
  };
  return labels[reason] || "Paiement";
}

function getButtonLabel(reason) {
  const labels = {
    acompte: "Payer l’acompte",
    solde: "Payer le solde",
    total: "Payer le séjour",
    complement: "Payer le complément",
  };
  return labels[reason] || "Procéder au paiement";
}

async function sendManualPaymentEmail({ bookingId, guestEmail, guestFirstName, guestLastName, startDate, endDate, amount, reason, message, paymentLink }) {
  const reasonLabel = getReasonLabel(reason);
  const buttonLabel = getButtonLabel(reason);

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${reasonLabel} à régler — La Maison Verte</h2>

      <p>Bonjour ${guestFirstName || ""} ${guestLastName || ""},</p>

      <p>
        Un lien de paiement sécurisé vous est envoyé concernant votre séjour à
        <strong>La Maison Verte à Arreau</strong>.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(startDate)}<br />
        <strong>Départ :</strong> ${formatDate(endDate)}<br />
        <strong>Motif :</strong> ${reasonLabel}<br />
        <strong>Montant à payer :</strong> ${formatMoney(amount)}
      </p>

      ${reason === "total" ? `
        <p>
          Ce paiement correspond au montant total convenu pour votre séjour.
          Après règlement, votre réservation sera considérée comme soldée.
        </p>
      ` : ""}

      ${message ? `<p><strong>Message :</strong><br />${message}</p>` : ""}

      <p style="margin-top:30px;">
        <a href="${paymentLink}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          ${buttonLabel}
        </a>
      </p>

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
      to: [guestEmail],
      reply_to: "contact@lamaisonverte65.fr",
      subject: `${reasonLabel} à régler - La Maison Verte`,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId, emailType: `manual_payment:${reason}`, toEmail: guestEmail, subject: `${reasonLabel} à régler - La Maison Verte`, status: "error", errorMessage: errorText });
    throw new Error(errorText);
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}
  await logEmail({ bookingId, emailType: `manual_payment:${reason}`, toEmail: guestEmail, subject: `${reasonLabel} à régler - La Maison Verte`, status: "sent", providerId: responseData?.id || null });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const adminAuth = await requireAdmin(event);
  if (adminAuth.error) return adminAuth.error;

  try {
    const data = JSON.parse(event.body || "{}");
    const {
      bookingId,
      guestEmail,
      guestFirstName,
      guestLastName,
      startDate,
      endDate,
      amount,
      reason = "solde",
      message = "",
    } = data;

    const allowedReasons = ["acompte", "solde", "total", "complement"];
    const safeReason = allowedReasons.includes(reason) ? reason : "complement";
    const numericAmount = Number(amount || 0);

    if (!bookingId || !guestEmail) {
      return { statusCode: 400, body: JSON.stringify({ error: "bookingId et guestEmail obligatoires" }) };
    }

    if (!numericAmount || numericAmount <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Montant invalide" }) };
    }

    const reasonLabel = getReasonLabel(safeReason);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: guestEmail,
      metadata: {
        booking_id: bookingId,
        payment_type: "manual",
        manual_reason: safeReason,
        manual_amount: String(numericAmount),
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
              name: `${reasonLabel} - La Maison Verte`,
              description: `${formatDate(startDate)} → ${formatDate(endDate)}`,
            },
            unit_amount: Math.round(numericAmount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: "https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://lamaisonverte65.fr/cancel",
    });

    await sendManualPaymentEmail({
      bookingId,
      guestEmail,
      guestFirstName,
      guestLastName,
      startDate,
      endDate,
      amount: numericAmount,
      reason: safeReason,
      message,
      paymentLink: session.url,
    });

    const { error } = await supabase.from("booking_requests").update({
      manual_payment_amount: numericAmount,
      manual_payment_link: session.url,
      manual_payment_reason: safeReason,
      manual_payment_message: message,
      manual_payment_status: "à payer",
      manual_payment_requested_at: new Date().toISOString(),
      manual_payment_stripe_session_id: session.id,
      updated_at: new Date().toISOString(),
    }).eq("id", bookingId);

    if (error) throw error;

    await logBookingEvent({
      bookingId,
      eventType: "manual_payment_link_sent",
      label: `${reasonLabel} demandé`,
      message: `Lien de paiement envoyé pour ${formatMoney(numericAmount)}`,
      metadata: { reason: safeReason, amount: numericAmount, sessionId: session.id },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url, sessionId: session.id, amount: numericAmount, reason: safeReason }),
    };
  } catch (error) {
    console.error("Erreur create-manual-payment-session:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
