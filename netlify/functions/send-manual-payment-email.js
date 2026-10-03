import { createClient } from "@supabase/supabase-js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";
import { authorizationResponse, authorizeAdminRequest } from "./_lib/admin-auth.js";
import { buildStoredManualPaymentEmail, validateAdminEmailRequest } from "./_lib/admin-email.js";
import { resendEmail } from "./_lib/resend-email.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const auth = await authorizeAdminRequest(event, supabase, { anyOf: [ADMIN_PERMISSIONS.managePayments] });
  if (!auth.ok) return authorizationResponse(auth);
  try {
    const request = validateAdminEmailRequest(JSON.parse(event.body || "{}"));
    if (!request.ok) return json(request.statusCode, { error: request.error });
    const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", request.bookingId).single();
    if (error || !booking) return json(404, { error: "Réservation introuvable." });
    const email = buildStoredManualPaymentEmail(booking);
    if (!email.ok) return json(email.statusCode, { error: email.error });
    const retryPayload = {
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [email.to],
      reply_to: "contact@lamaisonverte65.fr",
      subject: email.subject,
      html: email.html,
    };
    const response = await resendEmail(retryPayload);
    if (!response.ok) {
      const errorText = await response.text();
      await supabase.from("email_logs").insert([{
        booking_request_id: request.bookingId,
        email_type: "manual_payment_stored_link",
        to_email: email.to,
        subject: email.subject,
        status: "error",
        error_message: errorText,
        sent_at: new Date().toISOString(),
        retry_payload: retryPayload,
      }]);
      throw new Error("Envoi Resend refusé.");
    }
    const responseData = await response.json().catch(() => null);
    await supabase.from("email_logs").insert([{
      booking_request_id: request.bookingId,
      email_type: "manual_payment_stored_link",
      to_email: email.to,
      subject: email.subject,
      status: "sent",
      provider_id: responseData?.id || null,
      sent_at: new Date().toISOString(),
    }]);
    return json(200, { success: true });
  } catch (error) {
    console.error("Erreur email paiement manuel:", error);
    return json(500, { error: "Envoi impossible." });
  }
}
