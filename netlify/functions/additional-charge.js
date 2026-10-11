import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { validateAdditionalChargeCreate, canTransitionAdditionalCharge } from "./_lib/additional-charge.js";
import { expireOpenCheckoutSession } from "./_lib/stripe-checkout-session.js";

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

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);

  try {
    const body = JSON.parse(event.body || "{}");
    const action = String(body.action || "create").trim();

    if (action === "create") {
      const validation = validateAdditionalChargeCreate(body);
      if (!validation.ok) return json(validation.statusCode || 400, validation);
      const { bookingId, category, reasonLabel, amount, customerMessage, cleaningIssueId } = validation.value;

      const { data: booking, error: bookingError } = await supabase
        .from("booking_requests")
        .select("id,status")
        .eq("id", bookingId)
        .maybeSingle();
      if (bookingError) throw bookingError;
      if (!booking) return json(404, { ok: false, error: "Réservation introuvable." });

      if (cleaningIssueId) {
        const { data: issue, error: issueError } = await supabase
          .from("booking_cleaning_issues")
          .select("id,booking_request_id,status")
          .eq("id", cleaningIssueId)
          .maybeSingle();
        if (issueError) throw issueError;
        if (!issue || issue.booking_request_id !== bookingId) {
          return json(400, { ok: false, error: "Le signalement ménage ne correspond pas à cette réservation." });
        }
      }

      const now = new Date().toISOString();
      const { data: charge, error } = await supabase.from("booking_additional_charges").insert([{
        booking_request_id: bookingId,
        cleaning_issue_id: cleaningIssueId,
        category,
        reason_label: reasonLabel,
        amount,
        customer_message: customerMessage || null,
        status: "draft",
        created_by: auth.profile?.id || null,
        created_at: now,
        updated_at: now,
      }]).select("*").single();
      if (error) throw error;
      return json(201, { ok: true, charge });
    }

    if (action === "cancel") {
      const chargeId = String(body.chargeId || "").trim();
      if (!chargeId) return json(400, { ok: false, error: "chargeId obligatoire." });
      const { data: charge, error } = await supabase.from("booking_additional_charges").select("*").eq("id", chargeId).maybeSingle();
      if (error) throw error;
      if (!charge) return json(404, { ok: false, error: "Demande complémentaire introuvable." });
      if (!canTransitionAdditionalCharge(charge.status, "cancelled")) {
        return json(409, { ok: false, error: "Cette demande ne peut plus être annulée." });
      }
      if (charge.stripe_session_id) await expireOpenCheckoutSession(stripe, charge.stripe_session_id);
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase.from("booking_additional_charges").update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
      }).eq("id", charge.id).eq("status", charge.status).select("*").single();
      if (updateError) throw updateError;
      return json(200, { ok: true, charge: updated });
    }

    return json(400, { ok: false, error: "Action complémentaire invalide." });
  } catch (error) {
    console.error("Erreur additional-charge:", error);
    return json(500, { ok: false, error: "Impossible de traiter la demande complémentaire." });
  }
}
