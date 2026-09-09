const PROVIDER_LABELS = Object.freeze({ booking: "Booking", airbnb: "Airbnb" });

export function buildExternalCalendarSyncStatus(rows = [], {
  now = new Date(),
  staleAfterMs = 15 * 60 * 1000,
} = {}) {
  const bySource = new Map((rows || []).map((row) => [String(row?.source || "").toLowerCase(), row]));
  return Object.fromEntries(Object.keys(PROVIDER_LABELS).map((source) => {
    const value = bySource.get(source)?.last_reconciled_at || null;
    const lastSuccessful = value ? new Date(value) : null;
    const current = lastSuccessful
      && !Number.isNaN(lastSuccessful.getTime())
      && now.getTime() - lastSuccessful.getTime() <= staleAfterMs;
    return [source, {
      state: current ? "current" : "unavailable",
      lastSuccessfulSyncAt: lastSuccessful && !Number.isNaN(lastSuccessful.getTime())
        ? lastSuccessful.toISOString() : null,
    }];
  }));
}

export function getExternalCalendarSyncWarnings(syncStatus = {}) {
  return Object.entries(PROVIDER_LABELS).flatMap(([source, label]) => {
    const status = syncStatus?.[source];
    if (status?.state === "current") return [];
    if (!status?.lastSuccessfulSyncAt) {
      return [`${label} n’a encore aucune synchronisation réussie enregistrée.`];
    }
    return [`${label} n’a pas été synchronisé récemment (dernière réussite : ${new Date(status.lastSuccessfulSyncAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}).`];
  });
}
