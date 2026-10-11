import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { expireOpenCheckoutSession } from "./_lib/stripe-checkout-session.js";
import {
  buildCleaningIssueFromBooking,
  canTransitionCleaningIssue,
  validateCleaningIssueAction,
} from "./_lib/cleaning-issue.js";
import { sendCleaningOwnerNotification } from "./_lib/cleaning-owner-notification.js";

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

async function getIssue(bookingId) {
  const { data, error } = await supabase.from("booking_cleaning_issues")
    .select("*").eq("booking_request_id", bookingId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });
  const auth = await authorizeAdminRequest(event, supabase);
  if (!auth.ok) return authorizationResponse(auth);

  try {
    const input = validateCleaningIssueAction(JSON.parse(event.body || "{}"));
    if (!input.ok) return json(input.statusCode || 400, input);
    const { action, bookingId, note } = input.value;

    if (action === "report") {
      const { data: booking, error: bookingError } = await supabase.from("booking_requests")
        .select("id,cleaning_fee,cleaning_option,status,start_date,end_date,guest_first_name,guest_last_name").eq("id", bookingId).maybeSingle();
      if (bookingError) throw bookingError;
      if (!booking) return json(404, { ok: false, error: "Réservation introuvable." });
      const existing = await getIssue(bookingId);
      if (existing && existing.status !== "reported") {
        return json(409, { ok: false, error: "Ce dossier ménage a déjà été traité.", issue: existing });
      }

      const base = buildCleaningIssueFromBooking({
        ...booking,
        cleaning_fee: booking.cleaning_option === true ? 0 : booking.cleaning_fee,
      }, {
        note,
        reportedBy: auth.profile?.id || auth.authUser?.id || null,
      });
      const now = new Date().toISOString();
      let result;
      if (existing) {
        const updated = await supabase.from("booking_cleaning_issues").update({
          notes: base.notes,
          amount_due: base.amount_due,
          reported_by: base.reported_by,
          reported_at: now,
          updated_at: now,
        }).eq("id", existing.id).eq("status", "reported").select("*").single();
        if (updated.error) throw updated.error;
        result = updated.data;
      } else {
        const inserted = await supabase.from("booking_cleaning_issues").insert([{ ...base, reported_at: now }]).select("*").single();
        if (inserted.error) throw inserted.error;
        result = inserted.data;
      }
      let notificationPending = false;
      try {
        const reporterName = auth.profile?.display_name || auth.profile?.name || auth.profile?.email || auth.authUser?.email || null;
        const notification = await sendCleaningOwnerNotification({ booking, issue: result, reporterName, supabase });
        notificationPending = !notification.sent;
      } catch (notificationError) {
        console.error("Erreur alerte owner signalement ménage:", notificationError);
        notificationPending = true;
      }
      return json(notificationPending ? 202 : 200, { ok: true, issue: result, notificationPending });
    }

    if (!auth.isOwner) return json(403, { ok: false, error: "Droit propriétaire requis." });

    const issue = await getIssue(bookingId);
    if (!issue) return json(404, { ok: false, error: "Signalement ménage introuvable." });

    if (action === "confirm") {
      if (Number(issue.amount_due) <= 0) {
        return json(409, { ok: false, error: "Aucun montant ménage snapshoté facturable pour cette réservation." });
      }
      if (!canTransitionCleaningIssue(issue.status, "confirmed")) {
        return json(409, { ok: false, error: "Ce signalement ne peut pas être confirmé dans son état actuel." });
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase.from("booking_cleaning_issues").update({
        status: "confirmed",
        confirmed_at: now,
        cancelled_at: null,
        updated_at: now,
      }).eq("id", issue.id).eq("status", issue.status).select("*").single();
      if (error) throw error;
      return json(200, { ok: true, issue: data });
    }

    if (action === "cancel") {
      if (!canTransitionCleaningIssue(issue.status, "cancelled")) {
        return json(409, { ok: false, error: "Ce dossier ménage ne peut pas être annulé dans son état actuel." });
      }
      if (issue.stripe_session_id) await expireOpenCheckoutSession(stripe, issue.stripe_session_id);
      const now = new Date().toISOString();
      const { data, error } = await supabase.from("booking_cleaning_issues").update({
        status: "cancelled",
        cancelled_at: now,
        updated_at: now,
      }).eq("id", issue.id).eq("status", issue.status).select("*").single();
      if (error) throw error;
      return json(200, { ok: true, issue: data });
    }

    return json(400, { ok: false, error: "Action ménage invalide." });
  } catch (error) {
    console.error("Erreur cleaning-issue:", error);
    const message = error?.message === "cleaning_fee_snapshot_missing_or_invalid"
      ? "Le tarif ménage snapshoté est absent ou invalide : aucune facturation automatique n'est possible."
      : "Erreur de traitement du dossier ménage.";
    return json(error?.message === "cleaning_fee_snapshot_missing_or_invalid" ? 409 : 500, { ok: false, error: message });
  }
}
