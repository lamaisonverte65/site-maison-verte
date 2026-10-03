import test from "node:test";
import assert from "node:assert/strict";

import {
  isDepartureOnlyDate,
  selectionContainsUnavailableNight,
} from "../src/utils/publicCalendarSelection.js";

const occupied = ["2026-10-18", "2026-10-19", "2026-10-20"];
const departureOnly = ["2026-10-18"];

test("a stay may end on the day an existing stay starts", () => {
  assert.equal(selectionContainsUnavailableNight("2026-10-17", "2026-10-18", occupied), false);
  assert.equal(isDepartureOnlyDate("2026-10-18", occupied, departureOnly), true);
});

test("a stay may not start on an occupied night", () => {
  assert.equal(selectionContainsUnavailableNight("2026-10-18", "2026-10-19", occupied), true);
});

test("a new stay may start on the checkout date of the existing stay", () => {
  assert.equal(selectionContainsUnavailableNight("2026-10-21", "2026-10-22", occupied), false);
});

test("a stay crossing any occupied night remains rejected", () => {
  assert.equal(selectionContainsUnavailableNight("2026-10-17", "2026-10-19", occupied), true);
});

import { readFileSync } from "node:fs";

test("the public calendar exposes and consumes departure-only boundary dates", () => {
  const api = readFileSync("netlify/functions/calendar.js", "utf8");
  const page = readFileSync("src/pages/MaisonVerte.jsx", "utf8");

  assert.match(api, /departureBoundaryCandidates\.push\(booking\.start_date\)/);
  assert.match(api, /departureBoundaryCandidates\.push\(block\.start_date\)/);
  assert.match(api, /departureOnlyDates:\s*computeDepartureOnlyBoundaryDates\(departureBoundaryCandidates, unavailableDates\)/);
  assert.match(page, /setDepartureOnlyDates\(data\.departureOnlyDates \|\| \[\]\)/);
  assert.match(page, /selectionContainsUnavailableNight\(realStart, end, unavailableDates\)/);
});
