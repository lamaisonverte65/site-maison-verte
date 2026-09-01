import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPageEngagementPayload,
  createPageEngagementWriter,
  getAnalyticsSessionPageKey,
  getPageViewDurationSamples,
  getVisitSessionDuration,
  mergePageViewsWithEngagement,
  writeAnalyticsEvent,
  writePageViewOnce,
} from "../src/services/siteAnalyticsService.js";
import {
  getSessionId,
  getVisitEventType,
  isPageView,
} from "../src/utils/adminFormatters.js";

function createSupabaseInsertDouble(responses) {
  const calls = [];
  let updateCalls = 0;

  return {
    calls,
    get updateCalls() {
      return updateCalls;
    },
    supabase: {
      from(table) {
        assert.equal(table, "site_visits");
        return {
          insert(rows) {
            calls.push(rows);
            return Promise.resolve(responses[calls.length - 1] || { error: null });
          },
          update() {
            updateCalls += 1;
            throw new Error("public analytics must never update site_visits");
          },
        };
      },
    },
  };
}

const enrichedPageView = {
  page: "/",
  visitor_id: "visitor_1",
  session_id: "session_1",
  referrer: "https://example.test/source",
  referrer_domain: "example.test",
  source: "referral",
  event_type: "page_view",
  duration_seconds: 0,
  max_scroll_percent: 0,
  metadata: { title: "Accueil" },
};

test("a successful public page_view performs one enriched INSERT without SELECT or UPDATE", async () => {
  const db = createSupabaseInsertDouble([{ error: null }]);

  const result = await writeAnalyticsEvent({
    supabase: db.supabase,
    payload: enrichedPageView,
  });

  assert.deepEqual(result, { storage: "enriched" });
  assert.equal(db.calls.length, 1);
  assert.equal(db.updateCalls, 0);
  assert.equal(db.calls[0][0].event_type, "page_view");
  assert.deepEqual(db.calls[0][0].metadata, {
    title: "Accueil",
    event_type: "page_view",
    page: "/",
    session_id: "session_1",
  });
});

test("the legacy page_view fallback runs only after the enriched INSERT fails", async () => {
  const warnings = [];
  const db = createSupabaseInsertDouble([
    { error: new Error("unknown enriched column") },
    { error: null },
  ]);

  const result = await writeAnalyticsEvent({
    supabase: db.supabase,
    payload: enrichedPageView,
    onWarning: (message) => warnings.push(message),
  });

  assert.deepEqual(result, { storage: "fallback" });
  assert.equal(db.calls.length, 2);
  assert.deepEqual(db.calls[1], [{
    page: "/",
    visitor_id: "visitor_1",
    referrer: "https://example.test/source",
    referrer_domain: "example.test",
    source: "referral",
    country: undefined,
  }]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unknown enriched column/);
});

test("a successful enriched page_view never creates a fallback row", async () => {
  const db = createSupabaseInsertDouble([
    { error: null },
    { error: new Error("fallback must not run") },
  ]);

  await writeAnalyticsEvent({ supabase: db.supabase, payload: enrichedPageView });

  assert.equal(db.calls.length, 1);
});

test("two React effect cycles can record the same page_view only once", async () => {
  const db = createSupabaseInsertDouble([{ error: null }]);
  const writeState = { current: false };

  const first = await writePageViewOnce({
    writeState,
    supabase: db.supabase,
    payload: enrichedPageView,
  });
  const second = await writePageViewOnce({
    writeState,
    supabase: db.supabase,
    payload: enrichedPageView,
  });

  assert.deepEqual(first, { storage: "enriched" });
  assert.deepEqual(second, { storage: "skipped_duplicate" });
  assert.equal(db.calls.length, 1);
});

test("a completely failed page_view attempt releases the React cycle guard for retry", async () => {
  const db = createSupabaseInsertDouble([
    { error: new Error("enriched failed") },
    { error: new Error("fallback failed") },
    { error: null },
  ]);
  const writeState = { current: false };

  await assert.rejects(
    writePageViewOnce({
      writeState,
      supabase: db.supabase,
      payload: enrichedPageView,
      onWarning: () => {},
    }),
    /fallback failed/
  );
  const retry = await writePageViewOnce({
    writeState,
    supabase: db.supabase,
    payload: enrichedPageView,
  });

  assert.deepEqual(retry, { storage: "enriched" });
  assert.equal(db.calls.length, 3);
});

test("a fallback failure is surfaced instead of being silently ignored", async () => {
  const db = createSupabaseInsertDouble([
    { error: new Error("enriched denied") },
    { error: new Error("fallback denied") },
  ]);

  await assert.rejects(
    writeAnalyticsEvent({
      supabase: db.supabase,
      payload: enrichedPageView,
      onWarning: () => {},
    }),
    /fallback denied.*enriched denied/i
  );
  assert.equal(db.calls.length, 2);
});

test("non-page events stay typed and never fall back to an untyped row", async () => {
  const eventTypes = ["section_view", "scroll_depth", "link_click", "form_start", "page_engagement"];

  for (const eventType of eventTypes) {
    const successDb = createSupabaseInsertDouble([{ error: null }]);
    await writeAnalyticsEvent({
      supabase: successDb.supabase,
      payload: { ...enrichedPageView, event_type: eventType },
    });
    assert.equal(successDb.calls[0][0].event_type, eventType);
    assert.equal(successDb.calls[0][0].metadata.event_type, eventType);

    const failureDb = createSupabaseInsertDouble([{ error: new Error(`${eventType} denied`) }]);
    await assert.rejects(
      writeAnalyticsEvent({
        supabase: failureDb.supabase,
        payload: { ...enrichedPageView, event_type: eventType },
      }),
      new RegExp(`${eventType} denied`)
    );
    assert.equal(failureDb.calls.length, 1);
  }
});

test("page_engagement is a distinct append-only event carrying cumulative duration and scroll", () => {
  const payload = buildPageEngagementPayload(enrichedPageView, {
    durationSeconds: 42,
    maxScrollPercent: 75,
  });

  assert.equal(payload.event_type, "page_engagement");
  assert.equal(payload.duration_seconds, 42);
  assert.equal(payload.max_scroll_percent, 75);
  assert.equal(payload.metadata.event_type, "page_engagement");
  assert.equal(payload.metadata.duration_seconds, 42);
  assert.equal(payload.metadata.max_scroll_percent, 75);
});

test("identical page_engagement signals are inserted only once", async () => {
  const db = createSupabaseInsertDouble([{ error: null }]);
  const writeEngagement = createPageEngagementWriter({
    supabase: db.supabase,
    commonData: enrichedPageView,
  });

  const first = await writeEngagement({ durationSeconds: 20, maxScrollPercent: 50 });
  const duplicate = await writeEngagement({ durationSeconds: 20, maxScrollPercent: 50 });

  assert.deepEqual(first, { storage: "enriched" });
  assert.deepEqual(duplicate, { storage: "skipped_duplicate" });
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0][0].event_type, "page_engagement");
});

test("a failed page_engagement can be retried with the same cumulative values", async () => {
  const db = createSupabaseInsertDouble([
    { error: new Error("temporary failure") },
    { error: null },
  ]);
  const writeEngagement = createPageEngagementWriter({
    supabase: db.supabase,
    commonData: enrichedPageView,
  });

  await assert.rejects(
    writeEngagement({ durationSeconds: 20, maxScrollPercent: 50 }),
    /temporary failure/
  );
  const retry = await writeEngagement({ durationSeconds: 20, maxScrollPercent: 50 });

  assert.deepEqual(retry, { storage: "enriched" });
  assert.equal(db.calls.length, 2);
});

test("admin engagement aggregation takes the maximum heartbeat per session and page", () => {
  const pageViews = [{
    id: "page_1",
    event_type: "page_view",
    session_id: "session_1",
    visitor_id: "visitor_1",
    page: "/",
    duration_seconds: 0,
    max_scroll_percent: 0,
  }];
  const allEvents = [
    ...pageViews,
    { id: "engagement_1", event_type: "page_engagement", session_id: "session_1", page: "/", duration_seconds: 10, max_scroll_percent: 25 },
    { id: "engagement_2", event_type: "page_engagement", session_id: "session_1", page: "/", duration_seconds: 30, max_scroll_percent: 75 },
    { id: "engagement_3", event_type: "page_engagement", session_id: "session_1", page: "/", duration_seconds: 20, max_scroll_percent: 50 },
  ];

  const merged = mergePageViewsWithEngagement(pageViews, allEvents);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].event_type, "page_view");
  assert.equal(merged[0].duration_seconds, 30);
  assert.equal(merged[0].max_scroll_percent, 75);
});

test("legacy fallback rows without session_id keep their existing statistics", () => {
  const legacyRows = [{
    id: "legacy_1",
    visitor_id: "visitor_legacy",
    page: "/",
    duration_seconds: 12,
    max_scroll_percent: 40,
  }];

  const merged = mergePageViewsWithEngagement(legacyRows, legacyRows);

  assert.deepEqual(merged, legacyRows);
});

test("duration samples preserve every real modern page_view", () => {
  const rows = [
    { session_id: "session_1", page: "/", duration_seconds: 10 },
    { session_id: "session_1", page: "/", duration_seconds: 30 },
    { session_id: "session_1", page: "/tarifs", duration_seconds: 20 },
  ];

  assert.deepEqual(getPageViewDurationSamples(rows), [10, 30, 20]);
  assert.equal(getAnalyticsSessionPageKey(rows[0]), "session_1\u0000/");
});

test("legacy duration samples without session_id remain individually counted", () => {
  const rows = [
    { visitor_id: "visitor_legacy", page: "/", duration_seconds: 12 },
    { visitor_id: "visitor_legacy", page: "/", duration_seconds: 8 },
  ];

  assert.deepEqual(getPageViewDurationSamples(rows), [12, 8]);
  assert.equal(getAnalyticsSessionPageKey(rows[0]), null);
});

test("two real page_views stay two while three heartbeats only provide max duration and scroll", () => {
  const pageViews = [
    { id: "page_1", event_type: "page_view", session_id: "session_1", visitor_id: "visitor_1", page: "/", duration_seconds: 0, max_scroll_percent: 0 },
    { id: "page_2", event_type: "page_view", session_id: "session_1", visitor_id: "visitor_1", page: "/", duration_seconds: 0, max_scroll_percent: 0 },
  ];
  const heartbeats = [
    { id: "heartbeat_1", event_type: "page_engagement", session_id: "session_1", page: "/", duration_seconds: 10, max_scroll_percent: 25 },
    { id: "heartbeat_2", event_type: "page_engagement", session_id: "session_1", page: "/", duration_seconds: 30, max_scroll_percent: 75 },
    { id: "heartbeat_3", event_type: "page_engagement", session_id: "session_1", page: "/", duration_seconds: 20, max_scroll_percent: 50 },
  ];
  const allEvents = [...pageViews, ...heartbeats];

  const mergedPageViews = mergePageViewsWithEngagement(
    allEvents.filter(isPageView),
    allEvents
  );

  assert.equal(allEvents.filter(isPageView).length, 2);
  assert.equal(mergedPageViews.length, 2);
  assert.deepEqual(mergedPageViews.map((row) => row.event_type), ["page_view", "page_view"]);
  assert.deepEqual(getPageViewDurationSamples(mergedPageViews), [30, 30]);
  assert.deepEqual(mergedPageViews.map((row) => row.max_scroll_percent), [75, 75]);
  assert.equal(allEvents.filter((row) => getVisitEventType(row) === "page_engagement").length, 3);
});

test("historical and modern fixtures preserve page, session, event, duration, and scroll semantics", () => {
  const fixtures = [
    {
      name: "legacy fallback without session",
      events: [{ id: "legacy", visitor_id: "legacy_visitor", page: "/", duration_seconds: 12, max_scroll_percent: 40 }],
      expected: { pages: 1, sessions: 1, durations: [12], scrolls: [40], engagements: 0 },
    },
    {
      name: "historical enriched page view",
      events: [{ id: "old_enriched", event_type: "page_view", session_id: "old_session", page: "/", duration_seconds: 18, max_scroll_percent: 55 }],
      expected: { pages: 1, sessions: 1, durations: [18], scrolls: [55], engagements: 0 },
    },
    {
      name: "new page view with heartbeats",
      events: [
        { id: "new_page", event_type: "page_view", session_id: "new_session", page: "/", duration_seconds: 0, max_scroll_percent: 0 },
        { id: "new_engagement_1", event_type: "page_engagement", session_id: "new_session", page: "/", duration_seconds: 10, max_scroll_percent: 25 },
        { id: "new_engagement_2", event_type: "page_engagement", session_id: "new_session", page: "/", duration_seconds: 25, max_scroll_percent: 75 },
      ],
      expected: { pages: 1, sessions: 1, durations: [25], scrolls: [75], engagements: 2 },
    },
    {
      name: "two page views in one session",
      events: [
        { id: "repeat_1", event_type: "page_view", session_id: "repeat_session", page: "/", duration_seconds: 6, max_scroll_percent: 20 },
        { id: "repeat_2", event_type: "page_view", session_id: "repeat_session", page: "/", duration_seconds: 9, max_scroll_percent: 30 },
      ],
      expected: { pages: 2, sessions: 1, durations: [6, 9], scrolls: [20, 30], engagements: 0 },
    },
    {
      name: "same page in two sessions",
      events: [
        { id: "session_a_page", event_type: "page_view", session_id: "session_a", page: "/", duration_seconds: 7, max_scroll_percent: 35 },
        { id: "session_b_page", event_type: "page_view", session_id: "session_b", page: "/", duration_seconds: 11, max_scroll_percent: 45 },
      ],
      expected: { pages: 2, sessions: 2, durations: [7, 11], scrolls: [35, 45], engagements: 0 },
    },
  ];

  for (const fixture of fixtures) {
    const pageViews = fixture.events.filter(isPageView);
    const merged = mergePageViewsWithEngagement(pageViews, fixture.events);
    const actual = {
      pages: pageViews.length,
      sessions: new Set(pageViews.map(getSessionId)).size,
      durations: getPageViewDurationSamples(merged),
      scrolls: merged.map((row) => row.max_scroll_percent || 0),
      engagements: fixture.events.filter((row) => getVisitEventType(row) === "page_engagement").length,
    };
    assert.deepEqual(actual, fixture.expected, fixture.name);
  }
});

test("session duration sums historical page_views but counts one heartbeat maximum", () => {
  const historicalPageViews = [
    { id: "old_1", event_type: "page_view", session_id: "old_session", page: "/", duration_seconds: 6 },
    { id: "old_2", event_type: "page_view", session_id: "old_session", page: "/", duration_seconds: 9 },
  ];
  assert.equal(
    getVisitSessionDuration(historicalPageViews, historicalPageViews),
    15,
    "historical real page views retain their summed duration"
  );

  const modernPageViews = [
    { id: "new_1", event_type: "page_view", session_id: "new_session", page: "/", duration_seconds: 0 },
    { id: "new_2", event_type: "page_view", session_id: "new_session", page: "/", duration_seconds: 0 },
  ];
  const heartbeats = [
    { id: "heartbeat_1", event_type: "page_engagement", session_id: "new_session", page: "/", duration_seconds: 10 },
    { id: "heartbeat_2", event_type: "page_engagement", session_id: "new_session", page: "/", duration_seconds: 30 },
    { id: "heartbeat_3", event_type: "page_engagement", session_id: "new_session", page: "/", duration_seconds: 20 },
  ];
  const mergedModern = mergePageViewsWithEngagement(modernPageViews, [...modernPageViews, ...heartbeats]);
  assert.equal(
    getVisitSessionDuration(mergedModern, [...modernPageViews, ...heartbeats]),
    30,
    "three cumulative heartbeats contribute their maximum once"
  );

  const legacyRows = [
    { id: "legacy_1", visitor_id: "legacy_visitor", page: "/", duration_seconds: 12 },
    { id: "legacy_2", visitor_id: "legacy_visitor", page: "/", duration_seconds: 8 },
  ];
  assert.equal(getVisitSessionDuration(legacyRows, legacyRows), 20);
});
