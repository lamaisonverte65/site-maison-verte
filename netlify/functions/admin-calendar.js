import { createCalendarSupabaseClient, loadCalendarResponse } from "./_lib/calendar-response.js";
import { authorizeAdminRequest, authorizationResponse } from "./_lib/admin-auth.js";
import { ADMIN_PERMISSIONS } from "../../shared/adminPermissions.js";

export async function handler(event = {}, context, dependencies = {}) {
  if (event.httpMethod !== "GET") return { statusCode: 405, headers: { Allow: "GET" }, body: "" };
  try {
    const client = (dependencies.createClient || createCalendarSupabaseClient)();
    const auth = await authorizeAdminRequest(event, client, { anyOf: [ADMIN_PERMISSIONS.viewCalendar] });
    if (!auth.ok) return authorizationResponse(auth);
    return await loadCalendarResponse(client, { includePrivate: true });
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: "Calendrier temporairement indisponible." }) };
  }
}
