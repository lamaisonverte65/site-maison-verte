import test from "node:test";
import assert from "node:assert/strict";

const policy = await import("../src/components/admin/calendar/calendarRefreshPolicy.js").catch(() => ({}));

test("an active admin calendar stays mounted while its data refreshes", () => {
  assert.equal(typeof policy.shouldRenderAdminCalendar, "function");

  assert.equal(policy.shouldRenderAdminCalendar({
    activeTab: "calendar",
    loading: true,
    error: "",
  }), true);

  assert.equal(policy.shouldRenderAdminCalendar({
    activeTab: "calendar",
    loading: false,
    error: "",
  }), true);

  assert.equal(policy.shouldRenderAdminCalendar({
    activeTab: "requests",
    loading: true,
    error: "",
  }), false);

  assert.equal(policy.shouldRenderAdminCalendar({
    activeTab: "calendar",
    loading: true,
    error: "Lecture impossible",
  }), false);
});
