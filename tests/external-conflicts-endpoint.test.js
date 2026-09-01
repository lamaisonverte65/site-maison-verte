import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpointModule = await import("../netlify/functions/_lib/external-conflict-endpoint.js").catch(() => ({}));
const createExternalConflictEndpoint = endpointModule.createExternalConflictEndpoint;

const row = {
  id: "conflict-1",
  source: "booking",
  external_start_date: "2026-10-10",
  external_end_date: "2026-10-15",
  local_kind: "booking_request",
  local_id: "booking-1",
  local_start_date: "2026-10-12",
  local_end_date: "2026-10-16",
  occurrence_count: 2,
  first_detected_at: "2026-09-01T12:00:00.000Z",
  last_detected_at: "2026-09-01T12:05:00.000Z",
  guest_email: "secret@example.test",
  external_uid: "private-upstream-uid",
  owner_price: 900,
};

test("the open-conflict endpoint is GET-only", async () => {
  assert.equal(typeof createExternalConflictEndpoint, "function");
  const handler = createExternalConflictEndpoint({
    authorizeOwner: async () => ({ ok: true }),
    listOpen: async () => [],
  });
  const response = await handler({ httpMethod: "POST" });
  assert.equal(response.statusCode, 405);
});

test("housekeeping denial stops before conflict data is read", async () => {
  let reads = 0;
  const handler = createExternalConflictEndpoint({
    authorizeOwner: async () => ({ ok: false, statusCode: 403, error: "Droit propriétaire requis." }),
    listOpen: async () => { reads += 1; return [row]; },
  });
  const response = await handler({ httpMethod: "GET" });
  assert.equal(response.statusCode, 403);
  assert.equal(reads, 0);
  assert.deepEqual(JSON.parse(response.body), { error: "Droit propriétaire requis." });
});

test("an owner receives only minimal open-conflict fields", async () => {
  const handler = createExternalConflictEndpoint({
    authorizeOwner: async () => ({ ok: true }),
    listOpen: async () => [row],
  });
  const response = await handler({ httpMethod: "GET" });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.conflicts.length, 1);
  assert.deepEqual(body.conflicts[0], {
    id: "conflict-1",
    source: "booking",
    externalStartDate: "2026-10-10",
    externalEndDate: "2026-10-15",
    localKind: "booking_request",
    localId: "booking-1",
    localStartDate: "2026-10-12",
    localEndDate: "2026-10-16",
    occurrenceCount: 2,
    firstDetectedAt: "2026-09-01T12:00:00.000Z",
    lastDetectedAt: "2026-09-01T12:05:00.000Z",
  });
  assert.doesNotMatch(response.body, /secret@example|private-upstream-uid|owner_price|900/);
});

test("the Netlify adapter requires owner authorization and selects open rows explicitly", () => {
  const source = readFileSync("netlify/functions/get-external-occupancy-conflicts.js", "utf8");
  assert.match(source, /authorizeAdminRequest\(event, supabase, \{ ownerOnly: true \}\)/);
  assert.match(source, /\.from\("external_occupancy_conflicts"\)/);
  assert.match(source, /\.eq\("status", "open"\)/);
  assert.doesNotMatch(source, /\.select\("\*"\)/);
  assert.doesNotMatch(source, /guest_email|guest_phone|owner_price|estimated_total|external_uid/);
});
