import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createArrivalToken, shouldSendSecureArrivalReminder } from "./_lib/arrival-token.js";
import { escapeHtml } from "./_lib/html.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = process.env.URL || "https://lamaisonverte65.fr";

function nowIso() {
  return new Date().toISOString();
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR");
}

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTargetStartDate(daysAhead = 2) {
  const target = new Date();
  target.setHours(12, 0, 0, 0);
  target.setDate(target.getDate() + daysAhead);

  return toLocalDateKey(target);
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
      sent_at: nowIso(),
      metadata,
    },
  ]);

  if (error) {
    console.error("Erreur log email_logs :", error.message);
  }
}

async function alreadySentArrivalReminder(bookingId) {
  const { data, error } = await supabase
    .from("email_logs")
    .select("id")
    .eq("booking_request_id", bookingId)
    .eq("email_type", "arrival_reminder")
    .eq("status", "sent")
    .limit(1);

  if (error) {
    console.error("Erreur lecture email_logs arrival_reminder :", error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function sendArrivalReminderEmail(booking) {
  if (!booking.guest_email) {
    return { sent: false, reason: "missing_guest_email" };
  }

  const subject = "Votre heure d’arrivée - La Maison Verte";
  const capability = createArrivalToken(booking);
  let tokenClaim = supabase.from("booking_requests").update({
    arrival_token_hash: capability.hash,
    arrival_token_expires_at: capability.expiresAt,
    arrival_token_created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", booking.id);
  tokenClaim = booking.arrival_token_hash
    ? tokenClaim.eq("arrival_token_hash", booking.arrival_token_hash)
    : tokenClaim.is("arrival_token_hash", null);
  const { data: claimedBooking, error: tokenError } = await tokenClaim.select("id").maybeSingle();
  if (tokenError) throw new Error("Migration des jetons d'arrivée absente ou écriture impossible.");
  if (!claimedBooking?.id) return { sent: false, reason: "concurrent_secure_link_claim" };
  const arrivalUrl = `${SITE_URL}/arrival?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(capability.token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Préparation de votre arrivée</h2>

      <p>Bonjour ${escapeHtml(booking.guest_first_name)} ${escapeHtml(booking.guest_last_name)},</p>

      <p>
        Votre séjour à <strong>La Maison Verte à Arreau</strong> approche.
        Afin d’organiser votre accueil dans les meilleures conditions,
        merci de nous indiquer votre heure d’arrivée estimée.
      </p>

      <p>
        <strong>Arrivée :</strong> ${formatDate(booking.start_date)}<br />
        <strong>Départ :</strong> ${formatDate(booking.end_date)}
      </p>

      <p style="margin-top:30px;">
        <a
          href="${arrivalUrl}"
          style="
            background:#16a34a;
            color:white;
            padding:14px 22px;
            border-radius:12px;
            text-decoration:none;
            font-weight:bold;
            display:inline-block;
          "
        >
          Renseigner mon heure d’arrivée
        </a>
      </p>

      <p>
        Vous pouvez aussi répondre directement à cet email si vous préférez.
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
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    await logEmail({
      bookingId: booking.id,
      emailType: "arrival_reminder",
      toEmail: booking.guest_email,
      subject,
      status: "error",
      errorMessage: errorText,
      metadata: { tokenExpiresAt: capability.expiresAt },
    });

    return { sent: false, reason: errorText };
  }

  let responseData = null;
  try {
    responseData = await response.json();
  } catch (_) {}

  await logEmail({
    bookingId: booking.id,
    emailType: "arrival_reminder",
    toEmail: booking.guest_email,
    subject,
    status: "sent",
    providerId: responseData?.id || null,
    metadata: { tokenExpiresAt: capability.expiresAt },
  });

  return { sent: true };
}

async function runArrivalReminder() {
  const targetDate = getTargetStartDate(2);

  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("*")
    .in("status", ["deposit_paid", "paid", "fully_paid", "confirmed"])
    .eq("start_date", targetDate);

  if (error) {
    throw new Error(error.message);
  }

  const processed = [];
  const skipped = [];

  for (const booking of bookings || []) {
    if (booking.arrival_time) {
      skipped.push({
        bookingId: booking.id,
        reason: "arrival_time_already_set",
      });
      continue;
    }

    const sentAlready = await alreadySentArrivalReminder(booking.id);

    if (!shouldSendSecureArrivalReminder(booking, { reminderSent: sentAlready })) {
      skipped.push({
        bookingId: booking.id,
        reason: "already_sent",
      });
      continue;
    }

    const emailResult = await sendArrivalReminderEmail(booking);

    await logBookingEvent({
      bookingId: booking.id,
      eventType: "arrival_reminder_sent",
      label: "Relance heure d’arrivée envoyée",
      message: emailResult.sent
        ? "Email automatique envoyé à J-2 pour demander l’heure d’arrivée."
        : "Tentative d’envoi email J-2 échouée.",
      metadata: {
        targetDate,
        emailSent: emailResult.sent,
        emailReason: emailResult.reason || null,
      },
    });

    processed.push({
      bookingId: booking.id,
      emailSent: emailResult.sent,
    });
  }

  return {
    success: true,
    targetDate,
    processed,
    skipped,
  };
}

export const handler = schedule("0 9 * * *", async () => {
  try {
    const result = await runArrivalReminder();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Erreur send-arrival-reminder :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
});
