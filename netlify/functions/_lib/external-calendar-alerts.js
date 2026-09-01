export async function claimMissingAlerts(repository, actions) {
  const results = await Promise.all((actions || []).map(async (action) => (
    await repository.claim(action) ? action : null
  )));
  return results.filter(Boolean);
}

export async function collectExternalCalendarFeeds(
  sources,
  fetchEvents,
  toDateString,
  onSourceError = () => {},
) {
  const uids = new Set();
  const occupations = [];
  const successfulSources = [];

  for (const sourceConfig of sources || []) {
    try {
      const events = await fetchEvents(sourceConfig.url);
      const sourceUids = [];
      const sourceOccupations = [];
      for (const key in events) {
        const event = events[key];
        if (!event || event.type !== "VEVENT" || !event.uid) continue;
        const startDate = toDateString(event.start);
        const endDate = toDateString(event.end);
        if (!startDate || !endDate || endDate <= startDate) continue;
        sourceUids.push(`${sourceConfig.source}\u0000${event.uid}`);
        sourceOccupations.push({
          source: sourceConfig.source,
          external_uid: event.uid,
          start_date: startDate,
          end_date: endDate,
        });
      }
      sourceUids.forEach((uid) => uids.add(uid));
      occupations.push(...sourceOccupations);
      successfulSources.push(sourceConfig.source);
    } catch (error) {
      onSourceError(error, sourceConfig.source);
    }
  }

  return { uids, occupations, successfulSources };
}

export async function runIndependentAlertPaths(runConflictChecks, runMissingChecks) {
  const errors = [];
  let conflictResult;
  let missingResult;

  try {
    conflictResult = await runConflictChecks();
  } catch (error) {
    errors.push(error);
  }

  try {
    missingResult = await runMissingChecks();
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, "External calendar alert checks failed.");
  }
  return { conflictResult, missingResult };
}

export async function persistExternalOccupancies(repository, occupations, seenAt, successfulSources = null) {
  const timestamp = String(seenAt || "").trim();
  const byTarget = new Map();
  for (const occupation of occupations || []) {
    const source = String(occupation?.source || "").trim().toLowerCase();
    const externalUid = String(occupation?.external_uid || occupation?.uid || "").trim();
    const startDate = String(occupation?.start_date || "").slice(0, 10);
    const endDate = String(occupation?.end_date || "").slice(0, 10);
    if (!["booking", "airbnb"].includes(source) || !externalUid) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate <= startDate) continue;
    byTarget.set(`${source}\u0000${externalUid}`, {
      source,
      external_uid: externalUid,
      start_date: startDate,
      end_date: endDate,
      is_current: true,
      last_seen_at: timestamp,
      updated_at: timestamp,
    });
  }
  const rows = [...byTarget.values()];
  const auditedSources = new Set(
    (Array.isArray(successfulSources) ? successfulSources : rows.map((row) => row.source))
      .map((source) => String(source || "").trim().toLowerCase())
      .filter((source) => ["booking", "airbnb"].includes(source)),
  );
  for (const source of auditedSources) {
    const sourceRows = rows.filter((row) => row.source === source);
    if (sourceRows.length) await repository.upsertOccupancies(sourceRows);
    await repository.retireUnseenOccupancies(source, timestamp);
  }
  return rows;
}
