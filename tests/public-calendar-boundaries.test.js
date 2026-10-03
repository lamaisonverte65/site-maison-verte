import test from "node:test";
import assert from "node:assert/strict";

import { computeDepartureOnlyBoundaryDates } from "../netlify/functions/_lib/public-calendar-boundaries.js";

test("a reservation start is a usable departure boundary when the preceding night is free", () => {
  assert.deepEqual(
    computeDepartureOnlyBoundaryDates(["2026-10-18"], ["2026-10-18", "2026-10-19", "2026-10-20"]),
    ["2026-10-18"],
  );
});

test("a back-to-back departure and arrival date is fully blocked", () => {
  assert.deepEqual(
    computeDepartureOnlyBoundaryDates(["2026-10-18"], ["2026-10-17", "2026-10-18", "2026-10-19"]),
    [],
  );
});
