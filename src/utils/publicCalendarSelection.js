function parseDateKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function selectionContainsUnavailableNight(start, end, unavailableDates = []) {
  const unavailable = new Set(unavailableDates);
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);

  for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
    if (unavailable.has(formatDateKey(date))) return true;
  }

  return false;
}

export function isDepartureOnlyDate(key, unavailableDates = [], departureOnlyDates = []) {
  return unavailableDates.includes(key) && departureOnlyDates.includes(key);
}
