function getErrorMessage(error) {
  return error?.message || String(error || "erreur inconnue");
}

function getMetadata(row) {
  if (!row?.metadata) return {};
  if (typeof row.metadata === "object") return row.metadata;
  try {
    return JSON.parse(row.metadata);
  } catch {
    return {};
  }
}

function getEventType(row) {
  return row?.event_type || getMetadata(row).event_type || "page_view";
}

function getSessionId(row) {
  return row?.session_id || getMetadata(row).session_id || null;
}

function getPage(row) {
  return row?.page || getMetadata(row).page || "/";
}

export function getAnalyticsSessionPageKey(row) {
  const sessionId = getSessionId(row);
  if (!sessionId) return null;
  return `${sessionId}\u0000${getPage(row)}`;
}

function buildEnrichedPayload(payload) {
  return {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      event_type: payload.event_type,
      page: payload.page,
      session_id: payload.session_id,
    },
  };
}

function buildLegacyPageViewPayload(payload) {
  return {
    page: payload.page,
    visitor_id: payload.visitor_id,
    referrer: payload.referrer,
    referrer_domain: payload.referrer_domain,
    source: payload.source,
    country: payload.country,
  };
}

async function insertRows(supabase, rows) {
  try {
    const result = await supabase.from("site_visits").insert(rows);
    return result?.error || null;
  } catch (error) {
    return error;
  }
}

export async function writeAnalyticsEvent({
  supabase,
  payload,
  onWarning = (message) => console.warn(message),
}) {
  const enrichedPayload = buildEnrichedPayload(payload);
  const enrichedError = await insertRows(supabase, [enrichedPayload]);

  if (!enrichedError) return { storage: "enriched" };

  if (payload.event_type !== "page_view") {
    throw new Error(
      `Analytics ${payload.event_type || "event"} insert failed: ${getErrorMessage(enrichedError)}`,
      { cause: enrichedError }
    );
  }

  onWarning(`Analytics enrichi non enregistré, fallback simple : ${getErrorMessage(enrichedError)}`);
  const fallbackError = await insertRows(supabase, [buildLegacyPageViewPayload(payload)]);

  if (fallbackError) {
    throw new Error(
      `Analytics fallback failed: ${getErrorMessage(fallbackError)}; enriched insert failed: ${getErrorMessage(enrichedError)}`,
      { cause: fallbackError }
    );
  }

  return { storage: "fallback" };
}

export async function writePageViewOnce({ writeState, ...analyticsInput }) {
  if (writeState.current) return { storage: "skipped_duplicate" };
  writeState.current = true;

  try {
    return await writeAnalyticsEvent(analyticsInput);
  } catch (error) {
    writeState.current = false;
    throw error;
  }
}

export function buildPageEngagementPayload(commonData, {
  durationSeconds,
  maxScrollPercent,
}) {
  return {
    ...commonData,
    event_type: "page_engagement",
    duration_seconds: durationSeconds,
    max_scroll_percent: maxScrollPercent,
    metadata: {
      ...(commonData.metadata || {}),
      event_type: "page_engagement",
      duration_seconds: durationSeconds,
      max_scroll_percent: maxScrollPercent,
    },
  };
}

export function createPageEngagementWriter({ supabase, commonData }) {
  let lastSignature = null;

  return async function writePageEngagement({ durationSeconds, maxScrollPercent }) {
    const signature = `${durationSeconds}:${maxScrollPercent}`;
    if (signature === lastSignature) return { storage: "skipped_duplicate" };
    lastSignature = signature;

    try {
      return await writeAnalyticsEvent({
        supabase,
        payload: buildPageEngagementPayload(commonData, {
          durationSeconds,
          maxScrollPercent,
        }),
      });
    } catch (error) {
      if (lastSignature === signature) lastSignature = null;
      throw error;
    }
  };
}

export function mergePageViewsWithEngagement(pageViews, allEvents) {
  const engagementByPage = new Map();

  for (const event of allEvents || []) {
    if (getEventType(event) !== "page_engagement") continue;
    const key = getAnalyticsSessionPageKey(event);
    if (!key) continue;
    const existing = engagementByPage.get(key) || { duration: 0, maxScroll: 0 };
    engagementByPage.set(key, {
      duration: Math.max(existing.duration, Number(event.duration_seconds || getMetadata(event).duration_seconds || 0)),
      maxScroll: Math.max(existing.maxScroll, Number(event.max_scroll_percent || getMetadata(event).max_scroll_percent || 0)),
    });
  }

  return (pageViews || []).map((pageView) => {
    const key = getAnalyticsSessionPageKey(pageView);
    const engagement = key ? engagementByPage.get(key) : null;
    if (!engagement) return pageView;
    return {
      ...pageView,
      duration_seconds: Math.max(Number(pageView.duration_seconds || getMetadata(pageView).duration_seconds || 0), engagement.duration),
      max_scroll_percent: Math.max(Number(pageView.max_scroll_percent || getMetadata(pageView).max_scroll_percent || 0), engagement.maxScroll),
    };
  });
}

export function getPageViewDurationSamples(pageViews) {
  return (pageViews || []).map((pageView) => (
    Number(pageView.duration_seconds || getMetadata(pageView).duration_seconds || 0)
  ));
}

export function getVisitSessionDuration(pageViews, allEvents) {
  const engagementKeys = new Set();
  for (const event of allEvents || []) {
    if (getEventType(event) !== "page_engagement") continue;
    const key = getAnalyticsSessionPageKey(event);
    if (key) engagementKeys.add(key);
  }

  let historicalDuration = 0;
  const engagementDurationByPage = new Map();

  for (const pageView of pageViews || []) {
    const duration = Number(pageView.duration_seconds || getMetadata(pageView).duration_seconds || 0);
    const key = getAnalyticsSessionPageKey(pageView);
    if (key && engagementKeys.has(key)) {
      engagementDurationByPage.set(
        key,
        Math.max(engagementDurationByPage.get(key) || 0, duration)
      );
    } else {
      historicalDuration += duration;
    }
  }

  return historicalDuration
    + [...engagementDurationByPage.values()].reduce((sum, duration) => sum + duration, 0);
}
