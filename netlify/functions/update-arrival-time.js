import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { bookingId, arrivalTime } = JSON.parse(event.body || "{}");

    if (!bookingId || !arrivalTime) {
      return { statusCode: 400, body: JSON.stringify({ error: "bookingId et arrivalTime requis" }) };
    }

    const { error } = await supabase
      .from("booking_requests")
      .update({
        arrival_time: arrivalTime,
        arrival_time_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
