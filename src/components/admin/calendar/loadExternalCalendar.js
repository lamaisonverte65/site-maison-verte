import { getExternalCalendarSyncWarnings } from "../../../../shared/externalCalendarStatus.js";

export async function loadExternalCalendarForAdmin(fetchCalendar = fetch, accessToken = "") {
  const response = await fetchCalendar("/.netlify/functions/admin-calendar", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const calendarData = await response.json();

  if (!response.ok) {
    throw new Error(calendarData?.error || "Impossible de vérifier les calendriers Booking/Airbnb actuellement.");
  }

  return {
    calendarData,
    warnings: getExternalCalendarSyncWarnings(calendarData.externalCalendarSyncStatus),
  };
}
