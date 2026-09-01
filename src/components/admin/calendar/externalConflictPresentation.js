export function shouldLoadExternalConflicts(mode = "admin") {
  return mode === "admin";
}

export function normalizeOpenExternalConflicts(rows = []) {
  return (rows || [])
    .filter((row) => !row?.status || row.status === "open")
    .map((row) => ({
      id: row.id,
      source: row.source,
      externalStartDate: row.externalStartDate,
      externalEndDate: row.externalEndDate,
      localKind: row.localKind,
      localId: row.localId,
      localStartDate: row.localStartDate,
      localEndDate: row.localEndDate,
      occurrenceCount: row.occurrenceCount,
    }));
}

export function getExternalConflictDisplayState(conflicts = [], error = "") {
  if (String(error || "").trim()) {
    return {
      kind: "unavailable",
      message: "Impossible de vérifier les conflits actuellement.",
      verifiedNoConflicts: false,
    };
  }
  if ((conflicts || []).length > 0) {
    return {
      kind: "open",
      message: "Alerte : chevauchement Booking/Airbnb détecté",
      verifiedNoConflicts: false,
    };
  }
  return { kind: "clear", message: "", verifiedNoConflicts: true };
}

export function findLocalBookingForConflict(conflict, events = []) {
  if (conflict?.localKind !== "booking_request" || !conflict?.localId) return null;
  const event = (events || []).find((candidate) => (
    candidate?.extendedProps?.type === "booking_request"
    && candidate?.extendedProps?.reservation?.id === conflict.localId
  ));
  return event?.extendedProps?.reservation || null;
}
