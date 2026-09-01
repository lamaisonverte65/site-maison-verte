import test from "node:test";
import assert from "node:assert/strict";

const conflictModule = await import("../netlify/functions/_lib/external-occupancy-conflicts.js").catch(() => ({}));
const {
  buildExternalConflictAlertEmail,
  processExternalConflictAlerts,
  reconcileSuccessfulExternalSources,
} = conflictModule;

const conflict = (overrides = {}) => ({
  id: "conflict-1",
  source: "booking",
  external_uid: "external-uid-1",
  external_start_date: "2026-10-10",
  external_end_date: "2026-10-15",
  local_kind: "booking_request",
  local_id: "local-1",
  local_start_date: "2026-10-12",
  local_end_date: "2026-10-16",
  occurrence_count: 1,
  guest_email: "secret@example.test",
  guest_phone: "+33600000000",
  message: "private-message",
  owner_price: 900,
  ...overrides,
});

test("only distinct successfully fetched Booking and Airbnb sources are reconciled", async () => {
  assert.equal(typeof reconcileSuccessfulExternalSources, "function");
  const calls = [];
  const results = await reconcileSuccessfulExternalSources({
    async reconcileSource(source, detectedAt) {
      calls.push({ source, detectedAt });
      return { source };
    },
  }, ["booking", "BOOKING", "airbnb", "invalid", null], "2026-09-01T12:00:00.000Z");

  assert.deepEqual(calls, [
    { source: "booking", detectedAt: "2026-09-01T12:00:00.000Z" },
    { source: "airbnb", detectedAt: "2026-09-01T12:00:00.000Z" },
  ]);
  assert.deepEqual(results, [{ source: "booking" }, { source: "airbnb" }]);
});

test("an unavailable source produces no reconciliation call", async () => {
  const calls = [];
  const result = await reconcileSuccessfulExternalSources({
    async reconcileSource(source) { calls.push(source); },
  }, [], "2026-09-01T12:00:00.000Z");
  assert.deepEqual(result, []);
  assert.deepEqual(calls, []);
});

test("conflict email contains only operational dates and no unnecessary PII", () => {
  assert.equal(typeof buildExternalConflictAlertEmail, "function");
  const email = buildExternalConflictAlertEmail(conflict(), "owner@example.test");
  assert.equal(email.to, "owner@example.test");
  assert.equal(email.subject, "Alerte — chevauchement de réservation détecté");
  assert.match(email.html, /Booking/);
  assert.match(email.html, /2026-10-10/);
  assert.match(email.html, /2026-10-15/);
  assert.match(email.html, /réservation directe/i);
  assert.match(email.html, /intervention humaine est nécessaire/i);
  assert.doesNotMatch(email.html, /secret@example|33600000000|private-message|900/);
  assert.doesNotMatch(email.html, /external-uid-1/);
});

test("each claimed conflict is sent and marked once for its occurrence", async () => {
  const events = [];
  const claimed = [conflict(), conflict({ id: "conflict-2", source: "airbnb", occurrence_count: 3 })];
  const result = await processExternalConflictAlerts({
    repository: {
      async claimAlerts(now) { events.push(`claim:${now}`); return claimed; },
      async markSent(id, occurrence, now) { events.push(`sent:${id}:${occurrence}:${now}`); },
      async release() { throw new Error("release must not run"); },
    },
    ownerEmail: "owner@example.test",
    now: "2026-09-01T12:00:00.000Z",
    async sendEmail(email, item) { events.push(`email:${item.id}:${email.subject}`); },
  });

  assert.deepEqual(result, { claimed: 2, sent: 2, failed: 0 });
  assert.deepEqual(events, [
    "claim:2026-09-01T12:00:00.000Z",
    "email:conflict-1:Alerte — chevauchement de réservation détecté",
    "sent:conflict-1:1:2026-09-01T12:00:00.000Z",
    "email:conflict-2:Alerte — chevauchement de réservation détecté",
    "sent:conflict-2:3:2026-09-01T12:00:00.000Z",
  ]);
});

test("a persistent sent conflict is not emailed when the database claims nothing", async () => {
  let sends = 0;
  const result = await processExternalConflictAlerts({
    repository: {
      async claimAlerts() { return []; },
      async markSent() {},
      async release() {},
    },
    ownerEmail: "owner@example.test",
    now: "2026-09-01T12:00:00.000Z",
    async sendEmail() { sends += 1; },
  });
  assert.deepEqual(result, { claimed: 0, sent: 0, failed: 0 });
  assert.equal(sends, 0);
});

test("a delivery failure releases the exact occurrence for retry", async () => {
  const released = [];
  await assert.rejects(() => processExternalConflictAlerts({
    repository: {
      async claimAlerts() { return [conflict({ occurrence_count: 4 })]; },
      async markSent() { throw new Error("markSent must not run"); },
      async release(id, occurrence, now) { released.push({ id, occurrence, now }); },
    },
    ownerEmail: "owner@example.test",
    now: "2026-09-01T12:00:00.000Z",
    async sendEmail() { throw new Error("provider unavailable"); },
  }), /1 conflict alert/);
  assert.deepEqual(released, [{
    id: "conflict-1",
    occurrence: 4,
    now: "2026-09-01T12:00:00.000Z",
  }]);
});
