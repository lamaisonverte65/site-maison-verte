import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function sendExpiredEmail(booking) {
  if (!booking.guest_email) {
    return { sent: false, reason: "missing_guest_email" };
  }

  const subject = "Votre demande de réservation a expiré - La Maison Verte";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Votre demande de réservation a expiré</h2>

      <p>Bonjour ${booking.guest_first_name || ""} ${booking.guest_last_name || ""},</p>

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
      emailType: "booking_expired",
      toEmail: booking.guest_email,
      subject,
      status: "error",
      errorMessage: errorText,
      metadata: { status: booking.status, acceptanceExpiresAt: booking.acceptance_expires_at },
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
    subject,
    status: "sent",
    providerId: responseData?.id || null,
    metadata: { status: booking.status, acceptanceExpiresAt: booking.acceptance_expires_at },
  });

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

  for (const booking of bookings || []) {
    const amountPaid = Number(booking.amount_paid || 0);

    if (amountPaid > 0 || ["paid", "deposit_paid", "fully_paid", "confirmed"].includes(booking.status)) {
      skipped.push({
        bookingId: booking.id,
        reason: "already_paid",
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from("booking_requests")
      .update({
        status: "expired",
        payment_status: "expired",
        deposit_status: "annulé",
        balance_status: "annulé",
        owner_message:
          booking.owner_message ||
          "Demande expirée automatiquement : paiement non reçu dans le délai prévu.",
        updated_at: now,
      })
      .eq("id", booking.id)
      .eq("status", "accepted");

    if (updateError) {
      skipped.push({
        bookingId: booking.id,
        reason: updateError.message,
      });
      continue;
    }

    const emailResult = await sendExpiredEmail(booking);

    await logBookingEvent({
      bookingId: booking.id,
      eventType: "booking_expired",
      label: "Demande expirée automatiquement",
      message: "Paiement non reçu dans le délai prévu. Dates remises à disposition.",
      metadata: {
        acceptanceExpiresAt: booking.acceptance_expires_at,
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
    processed,
    skipped,
  };
}

export const handler = schedule("0 * * * *", async () => {
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
