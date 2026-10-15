import { createCalendarSupabaseClient, loadCalendarResponse } from "./_lib/calendar-response.js";
export { createCalendarSupabaseClient, enrichExternalReservationsFromAccounting } from "./_lib/calendar-response.js";

export async function handler(event = {}, context, dependencies = {}) {
  if (event.httpMethod && event.httpMethod !== "GET") return { statusCode: 405, headers: { Allow: "GET" }, body: "" };
  try {
    const client = (dependencies.createClient || createCalendarSupabaseClient)();
    return await loadCalendarResponse(client);
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Calendrier temporairement indisponible." }) };
  }
}
