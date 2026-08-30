import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  claimMissingAlerts,
  persistExternalOccupancies,
} from "../netlify/functions/_lib/external-calendar-alerts.js";

function readJavaScriptTree(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? readJavaScriptTree(path)
      : /\.(?:js|jsx|ts|tsx)$/.test(name) ? [readFileSync(path, "utf8")] : [];
  }).join("\n");
}

test("the external calendar checker is wired as a native scheduled-only function", () => {
  const source = readFileSync("netlify/functions/check-external-calendar-alerts.js", "utf8");
  const netlifyConfig = readFileSync("netlify.toml", "utf8");

  assert.match(source, /export const handler = schedule\("30 7 \* \* \*"/);
  assert.doesNotMatch(source, /export async function handler/);
  assert.match(netlifyConfig, /\[functions\."check-external-calendar-alerts"\][\s\S]*schedule = "30 7 \* \* \*"/);
});

test("no scheduler credential is exposed by the browser sources", () => {
  const browserSources = readJavaScriptTree("src");
  assert.doesNotMatch(browserSources, /SCHEDULED_FUNCTION_SECRET|VITE_.*(?:SECRET|SERVICE_ROLE|RESEND)/);
});

test("concurrent scheduled runs can claim each missing alert only once", async () => {
  const claimed = new Set();
  const repository = {
    async claim(action) {
      await Promise.resolve();
      if (claimed.has(action.id)) return false;
      claimed.add(action.id);
      return true;
    },
  };
  const actions = [{ id: "a", uid: "uid-a" }, { id: "b", uid: "uid-b" }];
  const [first, second] = await Promise.all([
    claimMissingAlerts(repository, actions),
    claimMissingAlerts(repository, actions),
  ]);
  assert.equal(first.length + second.length, 2);
  assert.deepEqual(new Set([...first, ...second].map((action) => action.id)), new Set(["a", "b"]));
});

test("failed claims are not returned for email sending", async () => {
  const result = await claimMissingAlerts({ claim: async () => false }, [{ id: "a" }]);
  assert.deepEqual(result, []);
});

test("scheduled synchronization persists only stable external occupation identity and dates", async () => {
  const batches = [];
  const retirements = [];
  const repository = {
    async upsertOccupancies(rows) { batches.push(rows); },
    async retireUnseenOccupancies(source, seenAt) { retirements.push({ source, seenAt }); },
  };
  const result = await persistExternalOccupancies(repository, [
    {
      source: "booking", external_uid: "uid-booking", start_date: "2026-09-01", end_date: "2026-09-05",
      guest_name: "Must not persist", phone: "+33600000000", price: 900,
    },
    {
      source: "airbnb", external_uid: "uid-airbnb", start_date: "2026-10-01", end_date: "2026-10-03",
      message: "Must not persist", payout: 500,
    },
  ], "2026-08-28T12:00:00.000Z");

  const expected = [
    {
      source: "booking", external_uid: "uid-booking", start_date: "2026-09-01", end_date: "2026-09-05",
      is_current: true, last_seen_at: "2026-08-28T12:00:00.000Z", updated_at: "2026-08-28T12:00:00.000Z",
    },
    {
      source: "airbnb", external_uid: "uid-airbnb", start_date: "2026-10-01", end_date: "2026-10-03",
      is_current: true, last_seen_at: "2026-08-28T12:00:00.000Z", updated_at: "2026-08-28T12:00:00.000Z",
    },
  ];
  assert.deepEqual(result, expected);
  assert.deepEqual(batches, [[expected[0]], [expected[1]]]);
  assert.deepEqual(retirements, [
    { source: "booking", seenAt: "2026-08-28T12:00:00.000Z" },
    { source: "airbnb", seenAt: "2026-08-28T12:00:00.000Z" },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /guest|phone|price|message|payout/i);
});

test("external occupation persistence is idempotent per source and UID and rejects malformed rows", async () => {
  const batches = [];
  const repository = {
    async upsertOccupancies(rows) { batches.push(rows); },
    async retireUnseenOccupancies() {},
  };
  const rows = await persistExternalOccupancies(repository, [
    { source: "booking", external_uid: "same", start_date: "2026-09-01", end_date: "2026-09-05" },
    { source: "booking", external_uid: "same", start_date: "2026-09-01", end_date: "2026-09-06" },
    { source: "other", external_uid: "bad", start_date: "2026-09-01", end_date: "2026-09-02" },
    { source: "airbnb", external_uid: "", start_date: "2026-09-01", end_date: "2026-09-02" },
  ], "2026-08-28T12:00:00.000Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].end_date, "2026-09-06");
  assert.equal(batches.length, 1);
});

test("a successful empty source retires older rows without inventing an occupation", async () => {
  const operations = [];
  const repository = {
    async upsertOccupancies(rows) { operations.push({ kind: "upsert", rows }); },
    async retireUnseenOccupancies(source, seenAt) { operations.push({ kind: "retire", source, seenAt }); },
  };

  const rows = await persistExternalOccupancies(
    repository,
    [],
    "2026-08-28T12:00:00.000Z",
    ["booking"],
  );

  assert.deepEqual(rows, []);
  assert.deepEqual(operations, [{
    kind: "retire", source: "booking", seenAt: "2026-08-28T12:00:00.000Z",
  }]);
});

test("an unsuccessful source is never retired", async () => {
  const operations = [];
  const repository = {
    async upsertOccupancies(rows) { operations.push({ kind: "upsert", rows }); },
    async retireUnseenOccupancies(source) { operations.push({ kind: "retire", source }); },
  };

  await persistExternalOccupancies(
    repository,
    [{ source: "booking", external_uid: "uid-booking", start_date: "2026-09-01", end_date: "2026-09-05" }],
    "2026-08-28T12:00:00.000Z",
    ["booking"],
  );

  assert.deepEqual(operations.map((operation) => operation.kind), ["upsert", "retire"]);
  assert.equal(operations.some((operation) => operation.source === "airbnb"), false);
});
