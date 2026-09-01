const PROVIDERS = new Set(["booking", "airbnb"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export function isTechnicalExternalOneNight(source, startDate, endDate) {
  const provider = String(source || "").trim().toLowerCase();
  const start = String(startDate || "").slice(0, 10);
  const end = String(endDate || "").slice(0, 10);
  if (!PROVIDERS.has(provider) || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return false;
  }
  return Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`) === DAY_MS;
}
