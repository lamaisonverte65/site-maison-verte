import { createClient } from "@supabase/supabase-js";
import { verifyArrivalCapability } from "./_lib/arrival-token.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    let input;
    try {
      input = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Corps JSON invalide." });
    }
    const bookingId = String(input.bookingId || "");
    const token = String(input.token || "");
    const arrivalTime = String(input.arrivalTime || "");
    if (!bookingId || !token || !arrivalTime) return json(403, { error: "Lien d'arrivée incomplet." });

    const { data: booking, error: fetchError } = await supabase
      .from("booking_requests")
      .select("id,status,start_date,end_date,arrival_token_hash,arrival_token_expires_at")
      .eq("id", bookingId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!booking) return json(403, { error: "Lien d'arrivée invalide." });

    const capability = verifyArrivalCapability({ booking, bookingId, token, arrivalTime });
    if (!capability.ok) return json(capability.statusCode, { error: capability.error });
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("booking_requests")
      .update({ arrival_time: capability.arrivalTime, arrival_time_updated_at: now, updated_at: now })
      .eq("id", bookingId)
      .eq("arrival_token_hash", booking.arrival_token_hash)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!updated) return json(409, { error: "Le lien d'arrivée a changé. Utilisez le dernier email reçu." });
    return json(200, { success: true });
  } catch (error) {
    console.error("Erreur mise à jour heure d'arrivée:", error);
    return json(500, { error: "Mise à jour impossible." });
  }
}
