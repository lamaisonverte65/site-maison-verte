import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { createArrivalToken, shouldSendSecureArrivalReminder } from "./_lib/arrival-token.js";
import { escapeHtml } from "./_lib/html.js";
import { resendEmail } from "./_lib/resend-email.js";

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

async function getCurrentKeyboxCode() {
  const { data, error } = await supabase
    .from("pricing_settings")
    .select("keybox_code")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return String(data?.keybox_code || "").trim();
}

async function sendArrivalReminderEmail(booking) {
  if (!booking.guest_email) {
    return { sent: false, reason: "missing_guest_email" };
  }

  const subject = "Préparez votre arrivée à La Maison Verte";
  const keyboxCode = await getCurrentKeyboxCode();
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
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#1f2933;">
      <h2>Votre arrivée à La Maison Verte</h2>
      <p>Bonjour ${escapeHtml(booking.guest_first_name)} ${escapeHtml(booking.guest_last_name)},</p>
      <p>Votre séjour approche. Voici toutes les informations utiles pour votre arrivée.</p>

      <h3>Adresse</h3>
      <p><strong>La Maison Verte — 3 Impasse Trassens, 65240 Arreau</strong></p>

      <h3>Récupération des clés</h3>
      <p>À votre arrivée, récupérez les clés dans la boîte à clés à l'aide du code ci-dessous.</p>
      <p><strong>Code de la boîte à clés :</strong> ${keyboxCode ? escapeHtml(keyboxCode) : "momentanément indisponible — contactez-nous avant votre arrivée."}</p>
      <p style="margin:24px 0;"><img src="${SITE_URL}/livret/procedure-boite-a-cles.png" alt="Procédure illustrée de la boîte à clés" style="display:block;width:100%;max-width:720px;height:auto;margin:0 auto;border:0;" /></p>

      <h3>Accès et stationnement</h3>
      <p>La maison se trouve dans une impasse piétonne. Vous pouvez consulter le plan d'accès et de stationnement avant votre arrivée :</p>
      <p><a href="${SITE_URL}/livret/plan-acces.jpg" style="color:#14532d;font-weight:bold;">Voir le plan d'accès et de stationnement</a></p>

      <h3>Votre heure d'arrivée</h3>
      ${booking.arrival_time ? `<p><strong>Heure actuellement indiquée :</strong> ${escapeHtml(booking.arrival_time)}</p>` : "<p>Vous pouvez nous indiquer votre heure d'arrivée estimée.</p>"}
      <p><a href="${arrivalUrl}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">${booking.arrival_time ? "Consulter ou modifier mon heure d’arrivée" : "Indiquer mon heure d’arrivée"}</a></p>

      <h3>Horaires</h3>
      <p><strong>Arrivée :</strong> à partir de 16 h.<br /><strong>Départ :</strong> avant 10 h.</p>
      <p>Ces horaires peuvent éventuellement être adaptés selon les départs et arrivées précédant ou suivant votre séjour. N’hésitez pas à nous contacter pour une demande particulière.</p>

      <h3>Wi-Fi</h3>
      <p><strong>Réseau :</strong> La Maison Verte<br /><strong>Mot de passe :</strong> lamaisonverte65</p>

      <h3>Livret d'accueil</h3>
      <p><a href="${SITE_URL}/livret" style="color:#14532d;font-weight:bold;">Consulter le livret d’accueil</a></p>

      <p style="margin-top:28px;">Une question avant votre arrivée ? Vous pouvez répondre directement à cet email ou nous appeler au <a href="tel:+33695938315">06 95 93 83 15</a>.</p>
      <p style="margin-top:26px;">Raphaël &amp; Emmanuelle<br /><a href="tel:+33695938315">06 95 93 83 15</a><br />La Maison Verte — Arreau</p>
    </div>
  `;

  const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [booking.guest_email],
      reply_to: "contact@lamaisonverte65.fr",
      subject,
      html,
    };
  const response = await resendEmail(retryPayload);

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
      label: "Informations d’arrivée J-2 envoyées",
      message: emailResult.sent
        ? "Email automatique d’arrivée envoyé à J-2."
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
