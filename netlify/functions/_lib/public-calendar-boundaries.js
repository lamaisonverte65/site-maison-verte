function previousIsoDate(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function computeDepartureOnlyBoundaryDates(candidateStartDates = [], unavailableDates = []) {
  const unavailable = new Set(unavailableDates.filter(Boolean));
  return [...new Set(candidateStartDates.filter(Boolean))]
    .filter((date) => {
      const previous = previousIsoDate(date);
      return previous && !unavailable.has(previous);
    })
    .sort();
}
