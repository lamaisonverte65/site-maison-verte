import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(event, supabaseClient) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) return { ok: false, statusCode: 401, error: "Session admin manquante." };

  const { data, error } = await supabaseClient.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  const allowed = getAdminEmails();

  if (error || !email) return { ok: false, statusCode: 401, error: "Session admin invalide." };
  if (allowed.length > 0 && !allowed.includes(email)) return { ok: false, statusCode: 403, error: "Compte non autorisé." };

  return { ok: true, user: data.user };
}

async function logBookingEvent({ bookingId, userEmail }) {
  if (!bookingId) return;
  const { error } = await supabase.from("booking_events").insert([{
    booking_request_id: bookingId,
    event_type: "booking_deleted_from_calendar",
    label: "Réservation supprimée",
    message: "Réservation supprimée depuis le calendrier admin.",
    actor: userEmail || "admin",
    metadata: { source: "calendar_admin" },
  }]);
  if (error) console.error("Erreur historique booking_events:", error.message);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const admin = await requireAdmin(event, supabase);
    if (!admin.ok) return { statusCode: admin.statusCode, body: JSON.stringify({ error: admin.error }) };

    const body = JSON.parse(event.body || "{}");
    const bookingId = body.bookingId;
    if (!bookingId) return { statusCode: 400, body: JSON.stringify({ error: "bookingId manquant." }) };

    const { data: existing, error: fetchError } = await supabase
      .from("booking_requests")
      .select("id,status")
      .eq("id", bookingId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return { statusCode: 404, body: JSON.stringify({ error: "Réservation introuvable." }) };

    await logBookingEvent({ bookingId, userEmail: admin.user?.email });

    // Suppression logique : la réservation disparaît du calendrier car CalendarAdmin filtre cancelled.
    // On conserve l'historique des paiements / emails / actions.
    const { data, error } = await supabase
      .from("booking_requests")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ success: true, booking: data }) };
  } catch (error) {
    console.error("Erreur delete-booking-request :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
