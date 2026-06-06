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
  const reviewUrl = `${SITE_URL}/avis?review=1&booking=${encodeURIComponent(booking.id)}#laisser-un-avis`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#1f2933;">
      <h2>Merci pour votre séjour à La Maison Verte</h2>

      <p>Bonjour ${booking.guest_first_name || ""},</p>

      <p>
        Nous espérons que vous avez passé un excellent séjour à
        <strong>La Maison Verte à Arreau</strong>.
      </p>

      <p>
        <strong>Séjour :</strong> ${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}
      </p>

      <p>
        Votre commentaire est précieux : il aide les futurs voyageurs à préparer leur séjour
        et contribue au développement de La Maison Verte.
      </p>

      <p>
        Les anciens voyageurs restent nos meilleurs ambassadeurs. Lors d'un futur séjour,
        n'hésitez pas à nous rappeler que vous avez déjà séjourné à La Maison Verte.
        Les clients fidèles bénéficient régulièrement d'attentions particulières et
        d'avantages lors de leurs réservations en direct.
      </p>

      <p style="margin-top:30px;">
        <a href="${GOOGLE_REVIEW_URL}" style="background:#1f6f3d;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;margin-right:10px;margin-bottom:10px;">
          Donner un avis Google
        </a>
        <a href="${reviewUrl}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;margin-bottom:10px;">
          Laisser un avis sur le site
        </a>
      </p>

      <p>
        Merci encore pour votre confiance et à bientôt dans les Pyrénées.
      </p>

      <p style="margin-top:26px;">
        Raphaël<br />
        La Maison Verte – Arreau
      </p>
    </div>
  `;

  const text = `Bonjour ${booking.guest_first_name || ""},\n\nNous espérons que vous avez passé un excellent séjour à La Maison Verte à Arreau.\n\nVous pouvez laisser un avis Google ici : ${GOOGLE_REVIEW_URL}
Ou laisser un avis sur notre site ici : ${reviewUrl}\n\nMerci encore pour votre confiance,\nRaphaël - La Maison Verte`;

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
