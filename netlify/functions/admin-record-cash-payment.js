import { createClient } from "@supabase/supabase-js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const auth = await authorizeAdminRequest(event, supabase, { ownerOnly: true });
  if (!auth.ok) return authorizationResponse(auth);
  try {
    const { bookingId, receiptDate } = JSON.parse(event.body || "{}");
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(String(bookingId || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(receiptDate || ""))) {
      return { statusCode: 400, body: JSON.stringify({ error: "Réservation ou date invalide." }) };
    }
    const { data, error } = await supabase.rpc("record_admin_cash_payment_atomic", { p_booking_id: bookingId, p_receipt_date: receiptDate });
    if (error) throw error;
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Erreur encaissement espèces :", error.message);
    return { statusCode: 409, body: JSON.stringify({ error: error.message }) };
  }
}
