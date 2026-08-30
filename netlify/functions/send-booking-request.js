import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { buildPublicBookingEmails, claimPublicBookingSubmission, isDuplicatePublicBooking, validatePublicBookingPayload } from "./_lib/public-booking.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => new Response(JSON.stringify(body), {
  status: statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export const config = { path: "/api/booking-request" };
const ipHash = (value) => createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
  .update(`public-booking-ip:${String(value || "")}`, "utf8")
  .digest("hex");

async function logEmail({ bookingId, emailType, toEmail, subject, status, errorMessage = null, providerId = null }) {
  const { error } = await supabase.from("email_logs").insert([{
    booking_request_id: bookingId, email_type: emailType, to_email: toEmail, subject, status,
    error_message: errorMessage, provider_id: providerId, sent_at: new Date().toISOString(),
  }]);
  if (error) console.error("Erreur log email_logs:", error.message);
}

async function sendEmail(email, bookingId, emailType) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [email.to],
      reply_to: "contact@lamaisonverte65.fr",
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!response.ok) {
    const providerError = await response.text();
    await logEmail({ bookingId, emailType, toEmail: email.to, subject: email.subject, status: "error", errorMessage: providerError.slice(0, 500) });
    throw new Error("Envoi email indisponible.");
  }
  const responseData = await response.json().catch(() => null);
  await logEmail({ bookingId, emailType, toEmail: email.to, subject: email.subject, status: "sent", providerId: responseData?.id || null });
}

export default async function handler(request, context) {
  if (request.method !== "POST") return json(405, { error: "Method Not Allowed" });
  let recordedBookingId = null;
  try {
    const { data: ipAllowed, error: ipLimitError } = await supabase.rpc("claim_public_rate_limit", {
      p_scope: "public_booking_ip",
      p_key_hash: ipHash(context?.ip),
      p_window_seconds: 60,
      p_limit: 5,
      p_now: new Date().toISOString(),
    });
    if (ipLimitError) throw ipLimitError;
    if (ipAllowed !== true) return json(429, { error: "Trop de demandes. Réessayez plus tard." });

    let input;
    try {
      input = await request.json();
    } catch {
      return json(400, { error: "Corps JSON invalide." });
    }
    const validated = validatePublicBookingPayload(input);
    if (!validated.ok) return json(validated.statusCode, { error: validated.error });

    const claimed = await claimPublicBookingSubmission({
      async claimFingerprint(fingerprint) {
        const { data, error } = await supabase.rpc("claim_public_rate_limit", {
          p_scope: "public_booking_duplicate",
          p_key_hash: fingerprint,
          p_window_seconds: 300,
          p_limit: 1,
          p_now: new Date().toISOString(),
        });
        if (error) throw error;
        return data === true;
      },
    }, validated.booking);
    if (!claimed) return json(409, { error: "Une demande identique a déjà été reçue récemment." });

    const duplicateSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: duplicates, error: duplicateError } = await supabase
      .from("booking_requests")
      .select("id,created_at,guest_first_name,guest_last_name,guest_email,guest_phone,adults_count,children_count,children_ages,baby_bed_needed,marketing_consent,message,start_date,end_date,nights,estimated_total,contract_accepted,contract_version")
      .eq("guest_email", validated.booking.guest_email)
      .eq("start_date", validated.booking.start_date)
      .eq("end_date", validated.booking.end_date)
      .gte("created_at", duplicateSince)
      .limit(10);
    if (duplicateError) throw duplicateError;
    if (isDuplicatePublicBooking(duplicates, validated.booking)) {
      return json(409, { error: "Une demande identique a déjà été reçue récemment." });
    }

    const { data: booking, error: insertError } = await supabase
      .from("booking_requests")
      .insert([validated.booking])
      .select("id")
      .single();
    if (insertError || !booking?.id) throw insertError || new Error("Création de la demande impossible.");
    recordedBookingId = booking.id;

    const ownerEmail = String(process.env.BOOKING_NOTIFICATION_EMAIL || "lamaisonverte65@gmail.com").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error("Configuration destinataire invalide.");
    const emails = buildPublicBookingEmails(validated.emailModel, { ownerEmail });
    await sendEmail(emails.owner, booking.id, "booking_request:owner");
    await sendEmail(emails.guest, booking.id, "booking_request:guest");
    return json(200, { success: true, bookingId: booking.id });
  } catch (error) {
    console.error("Erreur demande publique:", error);
    if (recordedBookingId) {
      return json(202, { success: true, bookingId: recordedBookingId, confirmationPending: true });
    }
    return json(500, { error: "La demande a été enregistrée ou traitée partiellement. Contactez-nous si vous ne recevez pas de confirmation." });
  }
}
