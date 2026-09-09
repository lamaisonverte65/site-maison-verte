import { buildExternalCalendarSyncStatus } from "../../../shared/externalCalendarStatus.js";
import { isTechnicalExternalOneNight } from "./external-calendar-rules.js";

function datesBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function loadPersistedExternalCalendar(repository, options = {}) {
  const [occupancies, successfulSyncs] = await Promise.all([
    repository.getCurrentOccupancies(),
    repository.getSuccessfulSyncs(),
  ]);
  const externalReservations = (occupancies || [])
    .filter((row) => row?.is_current !== false)
    .filter((row) => !isTechnicalExternalOneNight(row.source, row.start_date, row.end_date))
    .map((row) => {
      const sourceLabel = row.source === "airbnb" ? "Airbnb" : "Booking";
      return {
        source: row.source,
        start_date: row.start_date,
        end_date: row.end_date,
        title: `Client ${sourceLabel}`,
        guest_name: `Client ${sourceLabel}`,
        guest_email: null,
        guest_phone: null,
        uid: row.external_uid,
      };
    });
  return {
    externalReservations,
    unavailableDates: [...new Set(externalReservations.flatMap((row) => datesBetween(row.start_date, row.end_date)))].sort(),
    syncStatus: buildExternalCalendarSyncStatus(successfulSyncs, options),
  };
}
