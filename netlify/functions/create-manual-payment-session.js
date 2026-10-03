import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { escapeHtml } from "./_lib/html.js";
import { expireOpenCheckoutSession } from "./_lib/stripe-checkout-session.js";
import { contractualTotal, recordedPaidAmount } from "./_lib/booking-financial-authority.js";
import { resendEmail } from "./_lib/resend-email.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAYABLE_MANUAL_STATUSES = new Set(["accepted", "deposit_paid", "paid"]);

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

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null, retryPayload = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId || null,
    email_type: emailType,
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    retry_payload: retryPayload,
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

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
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

      <p>Bonjour ${escapeHtml(guestFirstName)} ${escapeHtml(guestLastName)},</p>

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

      ${message ? `<p><strong>Message :</strong><br />${escapeHtml(message).replace(/\r?\n/g, "<br />")}</p>` : ""}

      <p style="margin-top:30px;">
        <a href="${escapeHtml(paymentLink)}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">
          ${buttonLabel}
        </a>
      </p>

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages,
        puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [guestEmail],
      reply_to: "contact@lamaisonverte65.fr",
      subject: `${reasonLabel} à régler - La Maison Verte`,
      html,
    };
  const response = await resendEmail(retryPayload);

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId, emailType: `manual_payment:${reason}`, toEmail: guestEmail, subject: `${reasonLabel} à régler - La Maison Verte`, status: "error", errorMessage: errorText, retryPayload});
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

  const adminAuth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePayments] });
  if (!adminAuth.ok) return authorizationResponse(adminAuth);

  try {
    const data = JSON.parse(event.body || "{}");
    const {
      bookingId,
      amount,
      reason = "solde",
      message = "",
    } = data;

    const allowedReasons = ["acompte", "solde", "total", "complement"];
    const safeReason = allowedReasons.includes(reason) ? reason : "complement";
    const numericAmount = Number(amount || 0);

    if (!bookingId) {
      return { statusCode: 400, body: JSON.stringify({ error: "bookingId obligatoire" }) };
    }

    if (!numericAmount || numericAmount <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Montant invalide" }) };
    }

    if (String(message || "").length > 1500) {
      return { statusCode: 400, body: JSON.stringify({ error: "Message trop long" }) };
    }

    const { data: booking, error: bookingError } = await supabase.from("booking_requests").select("*").eq("id", bookingId).single();
    if (bookingError || !booking) return { statusCode: 404, body: JSON.stringify({ error: "Réservation introuvable" }) };
    if (!PAYABLE_MANUAL_STATUSES.has(String(booking.status || "").toLowerCase())) {
      return { statusCode: 409, body: JSON.stringify({ error: "Cette réservation n’est pas dans un état permettant de demander un paiement." }) };
    }
    const guestEmail = booking.guest_email;
    const guestFirstName = booking.guest_first_name;
    const guestLastName = booking.guest_last_name;
    const startDate = booking.start_date;
    const endDate = booking.end_date;
    if (!guestEmail) return { statusCode: 400, body: JSON.stringify({ error: "Email client manquant dans la réservation" }) };

    if (booking.contract_total != null) {
      const remainingDue = Math.max(contractualTotal(booking) - recordedPaidAmount(booking), 0);
      if (toCents(numericAmount) > toCents(remainingDue)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Le montant demandé dépasse le restant contractuel à encaisser.",
            remainingDue,
          }),
        };
      }
      if (remainingDue <= 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Cette réservation est déjà soldée." }) };
      }
    }

    const reasonLabel = getReasonLabel(safeReason);

    if (booking.manual_payment_stripe_session_id) {
      await expireOpenCheckoutSession(stripe, booking.manual_payment_stripe_session_id);
    }

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

    if (error) {
      try { await stripe.checkout.sessions.expire(session.id); } catch (expireError) { console.error("Erreur expiration session paiement manuel orpheline:", expireError); }
      throw error;
    }

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
