import test from "node:test";
import assert from "node:assert/strict";

const display = await import("../netlify/functions/_lib/external-calendar-display.js").catch(() => ({}));
const status = await import("../shared/externalCalendarStatus.js").catch(() => ({}));
const admin = await import("../src/components/admin/calendar/loadExternalCalendar.js").catch(() => ({}));
const calendar = await import("../netlify/functions/calendar.js").catch(() => ({}));

test("calendar Supabase initialization requires service_role and never falls back to anon", () => {
  assert.equal(typeof calendar.createCalendarSupabaseClient, "function");
  const calls = [];
  const factory = (...args) => {
    calls.push(args);
    return { kind: "supabase" };
  };

  assert.throws(() => calendar.createCalendarSupabaseClient({
    VITE_SUPABASE_URL: "https://example.test",
    VITE_SUPABASE_ANON_KEY: "anonymous-value-must-not-be-used",
  }, factory), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.deepEqual(calls, []);

  const client = calendar.createCalendarSupabaseClient({
    VITE_SUPABASE_URL: "https://example.test",
    VITE_SUPABASE_ANON_KEY: "anonymous-value-must-not-be-used",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
  }, factory);
  assert.deepEqual(client, { kind: "supabase" });
  assert.deepEqual(calls, [["https://example.test", "service-role-value"]]);
});

test("the displayed external calendar comes from current persisted occupations", async () => {
  assert.equal(typeof display.loadPersistedExternalCalendar, "function");
  const result = await display.loadPersistedExternalCalendar({
    async getCurrentOccupancies() {
      return [
        { id: "b1", source: "booking", external_uid: "booking-future", start_date: "2026-10-25", end_date: "2026-10-29", is_current: true },
        { id: "a1", source: "airbnb", external_uid: "airbnb-future", start_date: "2026-12-27", end_date: "2026-12-31", is_current: true },
        { id: "old", source: "booking", external_uid: "old", start_date: "2026-09-01", end_date: "2026-09-04", is_current: false },
      ];
    },
    async getSuccessfulSyncs() {
      return [
        { source: "booking", last_reconciled_at: "2026-09-09T09:57:00.000Z" },
        { source: "airbnb", last_reconciled_at: "2026-09-09T09:58:00.000Z" },
      ];
    },
  }, { now: new Date("2026-09-09T10:00:00.000Z") });

  assert.deepEqual(result.externalReservations, [
    { source: "booking", start_date: "2026-10-25", end_date: "2026-10-29", title: "Client Booking", guest_name: "Client Booking", guest_email: null, guest_phone: null, uid: "booking-future" },
    { source: "airbnb", start_date: "2026-12-27", end_date: "2026-12-31", title: "Client Airbnb", guest_name: "Client Airbnb", guest_email: null, guest_phone: null, uid: "airbnb-future" },
  ]);
  assert.deepEqual(result.unavailableDates, [
    "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28",
    "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30",
  ]);
  assert.deepEqual(result.syncStatus, {
    booking: { state: "current", lastSuccessfulSyncAt: "2026-09-09T09:57:00.000Z" },
    airbnb: { state: "current", lastSuccessfulSyncAt: "2026-09-09T09:58:00.000Z" },
  });
});

test("one-night Booking and Airbnb technical blocks remain absent", async () => {
  const result = await display.loadPersistedExternalCalendar({
    getCurrentOccupancies: async () => [
      { source: "booking", external_uid: "closed-b", start_date: "2026-10-10", end_date: "2026-10-11", is_current: true },
      { source: "airbnb", external_uid: "closed-a", start_date: "2026-12-10", end_date: "2026-12-11", is_current: true },
    ],
    getSuccessfulSyncs: async () => [],
  });
  assert.deepEqual(result.externalReservations, []);
  assert.deepEqual(result.unavailableDates, []);
});

test("missing or stale successful synchronization is explicit to the owner", () => {
  assert.equal(typeof status.buildExternalCalendarSyncStatus, "function");
  assert.equal(typeof status.getExternalCalendarSyncWarnings, "function");
  const syncStatus = status.buildExternalCalendarSyncStatus([
    { source: "booking", last_reconciled_at: "2026-09-09T09:44:59.000Z" },
  ], { now: new Date("2026-09-09T10:00:00.000Z"), staleAfterMs: 15 * 60 * 1000 });
  assert.deepEqual(syncStatus, {
    booking: { state: "unavailable", lastSuccessfulSyncAt: "2026-09-09T09:44:59.000Z" },
    airbnb: { state: "unavailable", lastSuccessfulSyncAt: null },
  });
  assert.deepEqual(status.getExternalCalendarSyncWarnings(syncStatus), [
    "Booking n’a pas été synchronisé récemment (dernière réussite : 09/09/2026 11:44).",
    "Airbnb n’a encore aucune synchronisation réussie enregistrée.",
  ]);
});

test("a persistent registry read failure is not converted to an empty calendar", async () => {
  await assert.rejects(display.loadPersistedExternalCalendar({
    getCurrentOccupancies: async () => { throw new Error("registry unavailable"); },
    getSuccessfulSyncs: async () => [],
  }), /registry unavailable/);
});

test("the admin loader exposes stale synchronization without discarding calendar data", async () => {
  assert.equal(typeof admin.loadExternalCalendarForAdmin, "function");
  const result = await admin.loadExternalCalendarForAdmin(async () => ({
    ok: true,
    async json() {
      return {
        unavailableDates: ["2026-10-25"],
        externalReservations: [{ uid: "booking-future" }],
        externalCalendarSyncStatus: {
          booking: { state: "unavailable", lastSuccessfulSyncAt: "2026-09-09T09:44:59.000Z" },
          airbnb: { state: "current", lastSuccessfulSyncAt: "2026-09-09T09:58:00.000Z" },
        },
      };
    },
  }));

  assert.deepEqual(result.calendarData.unavailableDates, ["2026-10-25"]);
  assert.deepEqual(result.warnings, [
    "Booking n’a pas été synchronisé récemment (dernière réussite : 09/09/2026 11:44).",
  ]);
});

test("the admin loader reports an unreadable registry instead of verified availability", async () => {
  assert.equal(typeof admin.loadExternalCalendarForAdmin, "function");
  await assert.rejects(admin.loadExternalCalendarForAdmin(async () => ({
    ok: false,
    status: 500,
    async json() {
      return { error: "Lecture du registre impossible." };
    },
  })), /Lecture du registre impossible/);
});

test("accounting imports enrich external calendar names only on an unambiguous match", () => {
  assert.equal(typeof calendar.enrichExternalReservationsFromAccounting, "function");
  const reservations = [
    { source: "booking", uid: "b-1", start_date: "2026-10-10", end_date: "2026-10-14", guest_name: "Client Booking", title: "Client Booking" },
    { source: "airbnb", uid: "a-1", start_date: "2026-11-01", end_date: "2026-11-04", guest_name: "Client Airbnb", title: "Client Airbnb" },
    { source: "booking", uid: "b-amb", start_date: "2026-12-01", end_date: "2026-12-03", guest_name: "Client Booking", title: "Client Booking" },
  ];
  const entries = [
    { source: "booking", metadata: { guest_name: "Jean Dupont", arrival_date: "2026-10-10", checkout_date: "2026-10-14", external_calendar_uid: "b-1" } },
    { source: "airbnb", metadata: { guest_name: "Marie Martin", arrival_date: "2026-11-01", checkout_date: "2026-11-04" } },
    { source: "booking", metadata: { guest_name: "Client Un", arrival_date: "2026-12-01", checkout_date: "2026-12-03" } },
    { source: "booking", metadata: { guest_name: "Client Deux", arrival_date: "2026-12-01", checkout_date: "2026-12-03" } },
  ];

  const enriched = calendar.enrichExternalReservationsFromAccounting(reservations, entries);
  assert.equal(enriched[0].guest_name, "Jean Dupont");
  assert.equal(enriched[0].accounting_match, true);
  assert.equal(enriched[1].guest_name, "Marie Martin");
  assert.equal(enriched[1].accounting_match, true);
  assert.equal(enriched[2].guest_name, "Client Booking");
  assert.equal(enriched[2].accounting_match, undefined);
});
