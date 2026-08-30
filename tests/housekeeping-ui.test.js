import test from "node:test";
import assert from "node:assert/strict";
import {
  createHousekeepingNote,
  fetchAdminDataForRole,
  fetchHousekeepingData,
} from "../src/services/housekeepingService.js";

function response(body, ok = true) {
  return { ok, async json() { return body; } };
}

test("housekeeping data uses only the dedicated authenticated backend endpoint", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response({ ok: true, reservations: [{ id: "booking-1" }] });
  };
  const result = await fetchHousekeepingData({ accessToken: "token-1", fetchImpl });
  assert.deepEqual(result, { reservations: [{ id: "booking-1" }] });
  assert.deepEqual(calls, [{
    url: "/.netlify/functions/housekeeping",
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify({ action: "list" }),
    },
  }]);
});

test("housekeeping role never invokes the owner dashboard loader", async () => {
  const calls = [];
  const result = await fetchAdminDataForRole("housekeeping", {
    loadHousekeeping: async () => { calls.push("housekeeping"); return { reservations: [] }; },
    loadOwner: async () => { calls.push("owner"); return { payments: [{ amount: 1000 }] }; },
  });
  assert.deepEqual(result, { reservations: [] });
  assert.deepEqual(calls, ["housekeeping"]);
});

test("owner role keeps the existing full dashboard loader", async () => {
  const calls = [];
  const result = await fetchAdminDataForRole("owner", {
    loadHousekeeping: async () => { calls.push("housekeeping"); return {}; },
    loadOwner: async () => { calls.push("owner"); return { payments: [] }; },
  });
  assert.deepEqual(result, { payments: [] });
  assert.deepEqual(calls, ["owner"]);
});

test("frontend creates only an append-only note through the dedicated notes endpoint", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body), authorization: options.headers.Authorization });
    return response({ ok: true, note: { id: "note-1", note: "Départ terminé." } });
  };
  const result = await createHousekeepingNote({
    accessToken: "token-2", fetchImpl, reservationId: "booking-1",
    note: "Départ terminé.",
  });
  assert.deepEqual(result, { id: "note-1", note: "Départ terminé." });
  assert.deepEqual(calls, [{
    url: "/.netlify/functions/housekeeping-notes",
    body: { action: "create", reservationId: "booking-1", note: "Départ terminé." },
    authorization: "Bearer token-2",
  }]);
});

test("frontend note service surfaces a missing target rejection without another write path", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return response({ ok: false, error: "Occupation externe locale introuvable." }, false);
  };
  await assert.rejects(
    () => createHousekeepingNote({
      accessToken: "token", fetchImpl, reservationId: "external:booking:invented", note: "Note",
    }),
    /Occupation externe locale introuvable/,
  );
  assert.deepEqual(calls, [{
    url: "/.netlify/functions/housekeeping-notes",
    body: { action: "create", reservationId: "external:booking:invented", note: "Note" },
  }]);
});
