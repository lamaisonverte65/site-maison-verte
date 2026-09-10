import test from "node:test";
import assert from "node:assert/strict";

process.env.VITE_SUPABASE_URL = "https://example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
const exportIcal = await import("../netlify/functions/export-ical.js");

test("the site iCal export contains every local blocker and keeps stored half-open dates", () => {
  assert.equal(typeof exportIcal.buildIcalCalendar, "function");

  const requests = [
    ["pending", "2026-10-01", "2026-10-03"],
    ["accepted", "2026-10-04", "2026-10-06"],
    ["deposit_paid", "2026-10-07", "2026-10-10"],
    ["paid", "2026-10-11", "2026-10-13"],
    ["fully_paid", "2026-10-14", "2026-10-17"],
    ["confirmed", "2026-10-18", "2026-10-20"],
    ["refused", "2026-11-01", "2026-11-03"],
    ["expired", "2026-11-04", "2026-11-06"],
    ["cancelled", "2026-11-07", "2026-11-09"],
  ].map(([status, start_date, end_date], index) => ({
    id: `${index + 1}`,
    status,
    start_date,
    end_date,
  }));

  const calendar = exportIcal.buildIcalCalendar({
    blocks: [{ id: "block-1", start_date: "2026-12-01", end_date: "2026-12-05" }],
    requests,
    now: new Date("2026-09-10T08:09:10.000Z"),
  });

  for (const [status, startDate, endDate] of requests.slice(0, 6).map((row) => [row.status, row.start_date, row.end_date])) {
    const id = requests.find((row) => row.status === status).id;
    assert.match(calendar, new RegExp(`UID:request-${id}@lamaisonverte65\\.fr[\\s\\S]*?DTSTART;VALUE=DATE:${startDate.replaceAll("-", "")}[\\s\\S]*?DTEND;VALUE=DATE:${endDate.replaceAll("-", "")}`));
  }

  for (const request of requests.slice(6)) {
    assert.doesNotMatch(calendar, new RegExp(`UID:request-${request.id}@lamaisonverte65\\.fr`));
  }

  assert.match(calendar, /UID:block-block-1@lamaisonverte65\.fr[\s\S]*?DTSTART;VALUE=DATE:20261201[\s\S]*?DTEND;VALUE=DATE:20261205/);
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 7);
});
