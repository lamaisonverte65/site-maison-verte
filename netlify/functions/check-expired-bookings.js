import { emailAutomationAllowed, emailAutomationSkippedResponse } from "./_lib/email-delivery-policy.js";
import { escapeHtml } from "./_lib/html.js";
import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { expireBookingOpenCheckoutSessions } from "./_lib/stripe-checkout-session.js";
import { resendEmail } from "./_lib/resend-email.js";
import { emailLanguageForAudience } from "../../shared/guestLocale.js";
import { buildLocalizedExpiredEmail } from "./_lib/guest-secondary-emails.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function nowIso() {
  return new Date().toISOString();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

async function logBookingEvent({ bookingId, eventType, label, message, metadata = {} }) {
  if (!bookingId) return;

  const { error } = await supabase.from("booking_events").insert([
    {
      booking_request_id: bookingId,
      event_type: eventType,
      label,
      message,
      actor: "system",
      metadata,
    },
  ]);

  if (error) {
    console.error("Erreur log booking_events :", error.message);
  }
}

async function logEmail({
  bookingId,
  emailType,
  toEmail,
  subject,
  status,
  errorMessage = null,
  providerId = null,
  metadata = {},
  retryPayload = null,
}) {
  const { error } = await supabase.from("email_logs").insert([
    {
      booking_request_id: bookingId || null,
      email_type: emailType,
      to_email: toEmail,
      subject,
      status,
      error_message: errorMessage,
      provider_id: providerId,
    retry_payload: retryPayload,
      sent_at: nowIso(),
      metadata,
    },
  ]);

  if (error) {
    console.error("Erreur log email_logs :", error.message);
  }
}

async function sendExpiredEmail(booking) {
  if (!booking.guest_email) {
    return { sent: false, reason: "missing_guest_email" };
  }

  const subject = "Votre demande de réservation a expiré - La Maison Verte";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Votre demande de réservation a expiré</h2>

      <p>Bonjour ${escapeHtml(booking.guest_first_name || "")} ${escapeHtml(booking.guest_last_name || "")},</p>

      <p>
        Votre demande de réservation pour <strong>La Maison Verte à Arreau</strong>
        avait été acceptée, mais le paiement demandé n’a pas été reçu dans le délai prévu.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}
      </p>

      <p>
        Les dates peuvent donc être remises à disposition.
      </p>

      <p>
        Si vous pensez qu’il s’agit d’une erreur ou si vous souhaitez refaire une demande,
        vous pouvez nous contacter en répondant à cet email.
      </p>

      <p style="margin-top:30px;font-size:13px;color:#666;">
        Pensez à vérifier vos courriers indésirables / spams si vous ne recevez pas nos prochains messages,
        puis ajoutez contact@lamaisonverte65.fr à vos contacts.
      </p>
    </div>
  `;

  const language = emailLanguageForAudience(booking);
  const localized = language === "fr" ? null : buildLocalizedExpiredEmail({ language, booking });
  const emailSubject = localized?.subject || subject;
  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject: emailSubject,
      html: localized?.html || html,
    };
  const response = await resendEmail(retryPayload);

  if (!response.ok) {
    const errorText = await response.text();

    await logEmail({
      bookingId: booking.id,
      emailType: "booking_expired",
      toEmail: booking.guest_email,
      subject: emailSubject,
      status: "error",
      errorMessage: errorText,
      metadata: { status: booking.status, acceptanceExpiresAt: booking.acceptance_expires_at },
      retryPayload,
    });

    return { sent: false, reason: errorText };
  }

  let responseData = null;
  try {
    responseData = await response.json();
  } catch (_) {}

  await logEmail({
    bookingId: booking.id,
    emailType: "booking_expired",
    toEmail: booking.guest_email,
    subject: emailSubject,
    status: "sent",
    providerId: responseData?.id || null,
    metadata: { status: booking.status, acceptanceExpiresAt: booking.acceptance_expires_at },
  });

  return { sent: true };
}

async function sendOwnerPaymentNotReceivedAlert(booking, clientEmailResult) {
  const ownerEmail = process.env.OWNER_EMAIL || "contact@lamaisonverte65.fr";
  const isFull = booking.payment_preference === "full";
  const label = isFull ? "Paiement intégral non reçu" : "Acompte non reçu";
  const name = `${booking.guest_first_name || ""} ${booking.guest_last_name || ""}`.trim() || "Client";
  const adminUrl = `${process.env.URL || "https://lamaisonverte65.fr"}/admin?booking=${encodeURIComponent(booking.id)}`;
  const subject = `${label} — ${name} — demande expirée`;
  const clientEmailStatus = clientEmailResult?.sent ? "envoyé" : `ÉCHEC${clientEmailResult?.reason ? ` — ${clientEmailResult.reason}` : ""}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${label}</h2><p>La demande acceptée a expiré sans réception du paiement initial.</p><p><strong>Client :</strong> ${escapeHtml(name)}<br><strong>Séjour :</strong> ${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}<br><strong>Email d’expiration client :</strong> ${escapeHtml(clientEmailStatus)}</p><p>Les dates ont été remises à disposition et les sessions Stripe ouvertes ont été neutralisées.</p><p><a href="${escapeHtml(adminUrl)}" style="background:#166534;color:white;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Ouvrir la réservation dans l’admin</a></p></div>`;

  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [ownerEmail],
      subject,
      html,
    };
  const response = await resendEmail(retryPayload);

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, emailType: "owner_initial_payment_not_received", toEmail: ownerEmail, subject, status: "error", errorMessage: errorText, retryPayload});
    console.error("Erreur email propriétaire paiement initial non reçu:", errorText);
    return { sent: false, reason: errorText };
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}
  await logEmail({ bookingId: booking.id, emailType: "owner_initial_payment_not_received", toEmail: ownerEmail, subject, status: "sent", providerId: responseData?.id || null });
  return { sent: true };
}

async function runExpiredBookingsCheck() {
  const now = nowIso();

  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("*")
    .eq("status", "accepted")
    .not("acceptance_expires_at", "is", null)
    .lt("acceptance_expires_at", now);

  if (error) {
    throw new Error(error.message);
  }

  const processed = [];
  const skipped = [];

  for (let booking of bookings || []) {
    const amountPaid = Number(booking.amount_paid || 0);

    if (amountPaid > 0 || ["paid", "deposit_paid", "fully_paid", "confirmed"].includes(booking.status)) {
      skipped.push({
        bookingId: booking.id,
        reason: "already_paid",
      });
      continue;
    }

    try {
      await expireBookingOpenCheckoutSessions(stripe, booking);
    } catch (stripeError) {
      skipped.push({
        bookingId: booking.id,
        reason: `stripe_expiration_failed:${stripeError.message}`,
      });
      continue;
    }

    // L'update conditionnel est la seule preuve d'une expiration acquise.
    // Une lecture ancienne ne doit pas provoquer d'email si un paiement, une
    // annulation ou une prolongation est intervenu entre-temps.
    const { data: expiredRows, error: updateError } = await supabase
      .from("booking_requests")
      .update({
        status: "expired",
        payment_status: "expired",
        deposit_status: "annulé",
        balance_status: "annulé",
        updated_at: now,
      })
      .eq("id", booking.id)
      .eq("status", "accepted")
      .lt("acceptance_expires_at", now)
      .or("amount_paid.is.null,amount_paid.eq.0")
      .select("*");

    if (updateError) {
      skipped.push({
        bookingId: booking.id,
        reason: updateError.message,
      });
      continue;
    }

    // Sans RETURNING, PostgREST peut réussir avec zéro ligne modifiée.
    // Ne jamais considérer une réponse vide/indéfinie comme un succès.
    if (!Array.isArray(expiredRows) || expiredRows.length !== 1 || expiredRows[0]?.status !== "expired") {
      skipped.push({
        bookingId: booking.id,
        reason: "expiration_not_applied",
      });
      continue;
    }

    booking = expiredRows[0];
    const emailResult = await sendExpiredEmail(booking);
    const ownerEmailResult = await sendOwnerPaymentNotReceivedAlert(booking, emailResult);

    await logBookingEvent({
      bookingId: booking.id,
      eventType: "booking_expired",
      label: "Demande expirée automatiquement",
      message: "Paiement non reçu dans le délai prévu. Dates remises à disposition.",
      metadata: {
        acceptanceExpiresAt: booking.acceptance_expires_at,
        emailSent: emailResult.sent,
        emailReason: emailResult.reason || null,
        ownerEmailSent: ownerEmailResult.sent,
        ownerEmailReason: ownerEmailResult.reason || null,
      },
    });

    processed.push({
      bookingId: booking.id,
      emailSent: emailResult.sent,
      ownerEmailSent: ownerEmailResult.sent,
      stripeSessionsExpired: true,
    });
  }

  return {
    success: true,
    processed,
    skipped,
  };
}

export const handler = schedule("0 * * * *", async () => {
  if (!emailAutomationAllowed()) return emailAutomationSkippedResponse();
  try {
    const result = await runExpiredBookingsCheck();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Erreur check-expired-bookings :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
});
