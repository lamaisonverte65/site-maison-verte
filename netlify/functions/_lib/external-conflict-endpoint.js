const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

function publicConflict(row = {}) {
  return {
    id: row.id,
    source: row.source,
    externalStartDate: row.external_start_date,
    externalEndDate: row.external_end_date,
    localKind: row.local_kind,
    localId: row.local_id,
    localStartDate: row.local_start_date,
    localEndDate: row.local_end_date,
    occurrenceCount: row.occurrence_count,
    firstDetectedAt: row.first_detected_at,
    lastDetectedAt: row.last_detected_at,
  };
}

export function createExternalConflictEndpoint({ authorizeOwner, listOpen }) {
  return async function externalConflictEndpoint(event) {
    if (event?.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });
    try {
      const authorization = await authorizeOwner(event);
      if (!authorization?.ok) {
        return json(authorization?.statusCode || 403, {
          error: authorization?.error || "Accès refusé.",
        });
      }
      const rows = await listOpen();
      return json(200, { conflicts: (rows || []).map(publicConflict) });
    } catch (error) {
      console.error("Erreur lecture conflits externes:", error);
      return json(500, { error: "Impossible de charger les conflits externes." });
    }
  };
}
