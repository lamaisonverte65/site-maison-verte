import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rules = await import("../netlify/functions/_lib/external-calendar-rules.js").catch(() => ({}));
const isTechnicalExternalOneNight = rules.isTechnicalExternalOneNight;

test("one-night Booking and Airbnb events are technical blocks", () => {
  assert.equal(typeof isTechnicalExternalOneNight, "function");
  assert.equal(isTechnicalExternalOneNight("booking", "2026-10-10", "2026-10-11"), true);
  assert.equal(isTechnicalExternalOneNight("airbnb", "2026-10-10", "2026-10-11"), true);
});

test("two-night events and unknown providers are not technical one-night blocks", () => {
  assert.equal(isTechnicalExternalOneNight("booking", "2026-10-10", "2026-10-12"), false);
  assert.equal(isTechnicalExternalOneNight("airbnb", "2026-10-10", "2026-10-12"), false);
  assert.equal(isTechnicalExternalOneNight("other", "2026-10-10", "2026-10-11"), false);
});

test("calendar export filtering uses the shared provider-neutral one-night rule", () => {
  const source = readFileSync("netlify/functions/calendar.js", "utf8");
  assert.match(source, /isTechnicalExternalOneNight\(sourceConfig\.source, startDate, endDate\)/);
  assert.doesNotMatch(source, /sourceConfig\.source === "booking" && durationInNights === 1/);
});
