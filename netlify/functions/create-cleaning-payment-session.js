import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { escapeHtml } from "./_lib/html.js";
import { resendEmail } from "./_lib/resend-email.js";
import { emailLanguageForAudience, appendGuestLanguage } from "../../shared/guestLocale.js";
import { buildLocalizedCleaningEmail } from "./_lib/guest-secondary-emails.js";
import { openSpecialPaymentCheckout, SpecialPaymentCheckoutError } from "./_lib/special-payment-checkout.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const formatDate = (value) => value ? new Date(value).toLocaleDateString("fr-FR") : "-";
const formatMoney = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));

async function logEmail({ bookingId, toEmail, subject, status, errorMessage = null, providerId = null, retryPayload = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId,
    email_type: "post_stay_cleaning_payment",
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    retry_payload: retryPayload,
    sent_at: new Date().toISOString(),
  }]);
  if (error) console.error("Erreur log email ménage après séjour:", error.message);
}

async function sendCleaningPaymentEmail({ booking, issue, paymentLink, idempotencyKey }) {
  const name = [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(" ").trim();
  const subject = "Ménage après séjour à régler - La Maison Verte";
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6">
    <h2>Ménage après séjour — La Maison Verte</h2>
    <p>Bonjour ${escapeHtml(name || "")},</p>
    <p>À la suite de votre séjour à <strong>La Maison Verte à Arreau</strong>, un forfait ménage reste à régler.</p>
    <p><strong>Séjour :</strong> ${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}<br>
    <strong>Montant :</strong> ${formatMoney(issue.amount_due)}</p>
    ${issue.notes ? `<p><strong>Constat :</strong><br>${escapeHtml(issue.notes).replace(/\r?\n/g, "<br>")}</p>` : ""}
    <p style="margin-top:28px"><a href="${escapeHtml(paymentLink)}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">Régler le ménage</a></p>
    <p style="margin-top:28px;font-size:13px;color:#666">Pour toute question, vous pouvez répondre directement à cet email.</p>
  </div>`;
  const language = emailLanguageForAudience(booking);
  const localized = language === "fr" ? null : buildLocalizedCleaningEmail({ language, booking, issue, paymentLink });
  const emailSubject = localized?.subject || subject;
  const emailHtml = localized?.html || html;
  const retryPayload = {
    from: "La Maison Verte <contact@lamaisonverte65.fr>",
    to: [booking.guest_email],
    reply_to: "contact@lamaisonverte65.fr",
    subject: emailSubject,
    html: emailHtml,
  };
  const response = await resendEmail(retryPayload, { idempotencyKey });
  if (!response.ok) {
    const errorText = await response.text();
    await logEmail({ bookingId: booking.id, toEmail: booking.guest_email, subject: emailSubject, status: "error", errorMessage: errorText, retryPayload });
    return { sent: false, error: errorText };
  }
  let responseData = null;
  try { responseData = await response.json(); } catch (_) {}
  await logEmail({ bookingId: booking.id, toEmail: booking.guest_email, subject: emailSubject, status: "sent", providerId: responseData?.id || null });
  return { sent: true };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  try {
    const body = JSON.parse(event.body || "{}");
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId || Object.keys(body).some((key) => key !== "bookingId")) {
      return json(400, { error: "bookingId est le seul paramètre autorisé." });
    }

    const [{ data: issue, error: issueError }, { data: booking, error: bookingError }] = await Promise.all([
      supabase.from("booking_cleaning_issues").select("*").eq("booking_request_id", bookingId).maybeSingle(),
      supabase.from("booking_requests").select("id,start_date,end_date,guest_first_name,guest_last_name,guest_email,communication_language").eq("id", bookingId).maybeSingle(),
    ]);
    if (issueError) throw issueError;
    if (bookingError) throw bookingError;
    if (!issue) return json(404, { error: "Dossier ménage introuvable." });
    if (!booking) return json(404, { error: "Réservation introuvable." });
    if (!["confirmed", "payment_requested"].includes(issue.status)) {
      return json(409, { error: "Ce dossier ménage n'est pas payable dans son état actuel." });
    }
    if (!booking.guest_email) return json(409, { error: "Email client manquant dans la réservation." });

    const amount = Number(issue.amount_due);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json(409, { error: "Le montant ménage snapshoté est absent ou invalide." });
    }

    const result = await openSpecialPaymentCheckout({
      kind: "cleaning", record: issue, booking, stripe, supabase,
      createParameters: () => ({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: booking.guest_email,
        metadata: {
          booking_id: booking.id,
          payment_type: "manual",
          manual_reason: "cleaning",
          cleaning_issue_id: issue.id,
          manual_amount: String(amount),
        },
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: {
              name: "Ménage après séjour - La Maison Verte",
              description: `${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }],
        success_url: appendGuestLanguage("https://lamaisonverte65.fr/success?session_id={CHECKOUT_SESSION_ID}", booking.communication_language),
        cancel_url: appendGuestLanguage("https://lamaisonverte65.fr/cancel", booking.communication_language),
      }),
      sendEmail: ({ record: currentIssue, booking: currentBooking, session }) =>
        sendCleaningPaymentEmail({
          booking: currentBooking, issue: currentIssue, paymentLink: session.url,
          idempotencyKey: `lmv:cleaning:${currentIssue.id}:${session.id}`,
        }),
    });
    const emailResult = result.emailResult;
    const updatedIssue = result.record;
    const session = result.session;
    await supabase.from("booking_events").insert([{
      booking_request_id: booking.id,
      event_type: "post_stay_cleaning_payment_requested",
      label: "Ménage après séjour demandé",
      message: `Lien de paiement ménage envoyé pour ${formatMoney(amount)}`,
      metadata: { cleaningIssueId: issue.id, sessionId: session.id, amount, reused: result.reused },
    }]);

    return json(emailResult.sent ? 200 : 202, {
      ok: true,
      url: session.url,
      sessionId: session.id,
      amount,
      notificationPending: !emailResult.sent,
      reused: result.reused,
    });
  } catch (error) {
    if (error instanceof SpecialPaymentCheckoutError) return json(error.statusCode, { error: error.message });
    console.error("Erreur create-cleaning-payment-session:", error);
    return json(500, { error: "Impossible de créer le paiement ménage." });
  }
}
