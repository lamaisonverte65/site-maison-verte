import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = process.env.URL || "https://lamaisonverte65.fr";
const GOOGLE_REVIEW_URL = process.env.GOOGLE_REVIEW_URL || "https://g.page/r/CasA-_8IxkGjEBM/review";

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

function getYesterdayEndDate() {
  const target = new Date();
  target.setHours(12, 0, 0, 0);
  target.setDate(target.getDate() - 1);
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
  if (error) console.error("Erreur log booking_events :", error.message);
}

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null, metadata = {} }) {
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
  if (error) console.error("Erreur log email_logs :", error.message);
}

async function alreadySentReviewRequest(bookingId) {
  const { data, error } = await supabase
    .from("email_logs")
    .select("id")
    .eq("booking_request_id", bookingId)
    .eq("email_type", "review_request")
    .eq("status", "sent")
    .limit(1);

  if (error) {
    console.error("Erreur lecture email_logs review_request :", error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function sendReviewRequestEmail(booking) {
  if (!booking.guest_email) return { sent: false, reason: "missing_guest_email" };

  const subject = "Merci pour votre séjour à La Maison Verte";

  const reviewUrl = `${SITE_URL}/?review=1&booking=${encodeURIComponent(booking.id)}#laisser-un-avis`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#1f2933;">
      <h2>Merci pour votre séjour à La Maison Verte</h2>
      <p>Bonjour ${booking.guest_first_name || ""},</p>
      <p>Nous espérons que votre séjour à <strong>La Maison Verte à Arreau</strong> s’est bien passé et que vous avez pleinement profité des Pyrénées.</p>

      <h3>Votre retour nous intéresse</h3>
      <p>S’il vous a manqué quelque chose, si un équipement pourrait être amélioré ou si vous avez une suggestion, <strong>répondez simplement à cet email</strong>. Vos remarques nous aident directement à améliorer la maison.</p>

      <h3>Partagez votre expérience</h3>
      <p>Si vous le souhaitez, vous pouvez aussi partager votre expérience pour aider les futurs voyageurs.</p>
      <p><a href="${reviewUrl}" style="background:#1f6f3d;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:10px;margin-bottom:10px;">Laisser un avis sur La Maison Verte</a></p>
      <p><a href="${GOOGLE_REVIEW_URL}" style="background:#ffffff;color:#1f6f3d;border:1px solid #1f6f3d;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;margin-bottom:10px;">Donner aussi un avis Google</a></p>

      <h3>10 % pour votre prochain séjour</h3>
      <p>Pour une prochaine réservation effectuée directement sur notre site, vous bénéficiez de <strong>10 % de réduction sur l’hébergement</strong> avec le code :</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:1px;">CLIENTFIDELE</p>
      <p>Ce code n’a pas de date d’expiration. La réduction concerne l’hébergement uniquement, hors forfait ménage et taxe de séjour.</p>

      <p>Merci encore pour votre confiance et au plaisir de vous accueillir de nouveau.</p>
      <p style="margin-top:26px;">Raphaël &amp; Emmanuelle<br /><a href="tel:+33795938315">07 95 93 83 15</a><br />La Maison Verte — Arreau</p>
    </div>
  `;

  const text = `Bonjour ${booking.guest_first_name || ""},

Nous espérons que votre séjour à La Maison Verte à Arreau s’est bien passé.

Votre retour nous intéresse : s’il vous a manqué quelque chose, si un équipement pourrait être amélioré ou si vous avez une suggestion, répondez simplement à cet email.

Avis La Maison Verte : ${reviewUrl}
Avis Google : ${GOOGLE_REVIEW_URL}

Pour une prochaine réservation directe sur notre site, le code CLIENTFIDELE vous donne 10 % de réduction sur l’hébergement, sans date d’expiration. La réduction ne s’applique ni au forfait ménage ni à la taxe de séjour.

Merci encore pour votre confiance et au plaisir de vous accueillir de nouveau.

Raphaël & Emmanuelle
07 95 93 83 15
La Maison Verte — Arreau`;

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
      text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, emailType: "review_request", toEmail: booking.guest_email, subject, status: "error", errorMessage: errorText, metadata: { reviewUrl, googleReviewUrl: GOOGLE_REVIEW_URL } });
    return { sent: false, reason: errorText };
  }

  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}

  await logEmail({ bookingId: booking.id, emailType: "review_request", toEmail: booking.guest_email, subject, status: "sent", providerId: responseData?.id || null, metadata: { reviewUrl, googleReviewUrl: GOOGLE_REVIEW_URL } });
  return { sent: true };
}

async function runReviewRequest() {
  const targetEndDate = getYesterdayEndDate();

  const { data: bookings, error } = await supabase
    .from("booking_requests")
    .select("*")
    .in("status", ["deposit_paid", "paid", "fully_paid", "confirmed"])
    .eq("end_date", targetEndDate);

  if (error) throw new Error(error.message);

  const processed = [];
  const skipped = [];

  for (const booking of bookings || []) {
    if (!booking.guest_email) {
      skipped.push({ bookingId: booking.id, reason: "missing_guest_email" });
      continue;
    }

    const sentAlready = await alreadySentReviewRequest(booking.id);
    if (sentAlready) {
      skipped.push({ bookingId: booking.id, reason: "already_sent" });
      continue;
    }

    const emailResult = await sendReviewRequestEmail(booking);

    await logBookingEvent({
      bookingId: booking.id,
      eventType: "review_request_sent",
      label: "Demande d’avis envoyée",
      message: emailResult.sent ? "Email automatique envoyé J+1 après le départ pour demander un avis." : "Tentative d’envoi de demande d’avis échouée.",
      metadata: { targetEndDate, emailSent: emailResult.sent, emailReason: emailResult.reason || null },
    });

    processed.push({ bookingId: booking.id, emailSent: emailResult.sent });
  }

  return { success: true, targetEndDate, processed, skipped };
}

export const handler = schedule("0 10 * * *", async () => {
  try {
    const result = await runReviewRequest();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    console.error("Erreur send-stay-review-request :", error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
});
