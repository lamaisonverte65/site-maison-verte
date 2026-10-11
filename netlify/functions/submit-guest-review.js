import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { buildGuestReviewOwnerEmail, createGuestReviewValidationToken, validateGuestReviewPayload } from "./_lib/guest-review-validation.js";
import { resendEmail } from "./_lib/resend-email.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => new Response(JSON.stringify(body), { status: statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const SITE_URL = process.env.URL || "https://lamaisonverte65.fr";
const ipHash = (value) => createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
  .update(`guest-review-ip:${String(value || "")}`, "utf8").digest("hex");

async function logEmail({ toEmail, subject, status, errorMessage = null, providerId = null, retryPayload = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: null,
    email_type: "guest_review_validation",
    to_email: toEmail,
    subject,
    status,
    error_message: errorMessage,
    provider_id: providerId,
    sent_at: new Date().toISOString(),
    retry_payload: retryPayload,
  }]);
  if (error) console.error("Erreur log email avis:", error.message);
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json(405, { error: "Method Not Allowed" });

  try {
    const { data: ipAllowed, error: rateLimitError } = await supabase.rpc("claim_public_rate_limit", {
      p_scope: "guest_review_ip",
      p_key_hash: ipHash(context?.ip),
      p_window_seconds: 3600,
      p_limit: 5,
      p_now: new Date().toISOString(),
    });
    if (rateLimitError) throw rateLimitError;
    if (ipAllowed !== true) return json(429, { error: "Trop d’avis envoyés. Réessayez plus tard." });

    let input;
    try { input = await request.json(); } catch { return json(400, { error: "Corps JSON invalide." }); }
    const validated = validateGuestReviewPayload(input);
    if (!validated.ok) return json(validated.statusCode, { error: validated.error });

    const { data: review, error: insertError } = await supabase
      .from("guest_reviews")
      .insert([validated.review])
      .select("id, created_at, display_name, guest_first_name, rating, comment, stay_period, status")
      .single();
    if (insertError) throw insertError;

    const ownerEmail = String(process.env.BOOKING_NOTIFICATION_EMAIL || "lamaisonverte65@gmail.com").trim().toLowerCase();
    const token = createGuestReviewValidationToken(review.id);
    const validationUrl = `${SITE_URL}/avis-validation?token=${encodeURIComponent(token)}`;
    const email = buildGuestReviewOwnerEmail(review, validationUrl, ownerEmail);
    const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [email.to],
      reply_to: "contact@lamaisonverte65.fr",
      subject: email.subject,
      html: email.html,
    };

    const response = await resendEmail(retryPayload);
    if (!response.ok) {
      const providerError = await response.text();
      await logEmail({ toEmail: email.to, subject: email.subject, status: "error", errorMessage: providerError.slice(0, 500), retryPayload });
      return json(202, { success: true, reviewId: review.id, notificationPending: true });
    }
    const responseData = await response.json().catch(() => null);
    await logEmail({ toEmail: email.to, subject: email.subject, status: "sent", providerId: responseData?.id || null });
    return json(200, { success: true, reviewId: review.id });
  } catch (error) {
    console.error("Erreur soumission avis:", error);
    return json(500, { error: "L’avis n’a pas pu être enregistré. Réessayez ou contactez-nous." });
  }
}
