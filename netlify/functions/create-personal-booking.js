import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getAdminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(event, supabase) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { ok: false, statusCode: 401, error: "Session admin manquante." };
  }

  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  const allowed = getAdminEmails();

  if (error || !email) {
    return { ok: false, statusCode: 401, error: "Session admin invalide." };
  }

  if (allowed.length > 0 && !allowed.includes(email)) {
    return { ok: false, statusCode: 403, error: "Compte non autorisé." };
  }

  return { ok: true, user: data.user };
}

function nightsBetween(startDate, endDate) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 0);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const admin = await requireAdmin(event, supabase);
    if (!admin.ok) {
      return { statusCode: admin.statusCode, body: JSON.stringify({ error: admin.error }) };
    }

    const body = JSON.parse(event.body || "{}");
    const startDate = body.startDate;
    const endDate = body.endDate;

    if (!startDate || !endDate || String(endDate) <= String(startDate)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Période invalide." }) };
    }

    const firstName = body.firstName || "Réservation";
    const lastName = body.lastName || "personnelle";
    const nights = nightsBetween(startDate, endDate);
    const total = Number(body.total || 0);

    const { data: booking, error } = await supabase
      .from("booking_requests")
      .insert([
        {
          guest_first_name: firstName,
          guest_last_name: lastName,
          guest_email: body.email || null,
          guest_phone: body.phone || null,
          start_date: startDate,
          end_date: endDate,
          nights,
          estimated_total: total,
          owner_price: total,
          amount_paid: Number(body.amountPaid || 0),
          status: body.status || "confirmed",
          payment_status: "manual_personal_booking",
          deposit_status: "non applicable",
          balance_status: "non applicable",
          message: body.notes || "Réservation personnelle créée depuis le calendrier admin.",
          owner_message: body.notes || "Réservation personnelle créée depuis le calendrier admin.",
          contract_accepted: false,
          contract_version: "admin_personal",
          confirmed_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    await supabase.from("booking_events").insert([
      {
        booking_request_id: booking.id,
        event_type: "personal_booking_created",
        label: "Réservation personnelle créée",
        message: body.notes || "Créée depuis le calendrier admin.",
        actor: "admin",
        metadata: { source: "calendar_admin", total, amountPaid: Number(body.amountPaid || 0) },
      },
    ]);

    return { statusCode: 200, body: JSON.stringify({ success: true, booking }) };
  } catch (error) {
    console.error("Erreur create-personal-booking :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
