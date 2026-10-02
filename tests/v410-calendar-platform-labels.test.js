import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/CalendarAdmin.jsx", import.meta.url), "utf8");
const helpers = await import("../src/components/admin/calendar/calendarHelpers.js").catch(() => ({}));

test("calendar keeps imported Booking/Airbnb booking_requests labelled by platform", () => {
  assert.match(source, /reservationSource\.includes\("booking"\)/);
  assert.match(source, /reservationSource\.includes\("airbnb"\)/);
  assert.match(source, /\? "Booking"/);
  assert.match(source, /\? "Airbnb"/);
});

test("external calendar title can use a guest name supplied by accounting reconciliation", () => {
  assert.equal(typeof helpers.getExternalTitle, "function");
  assert.equal(helpers.getExternalTitle({
    reservation: { guest_name: "Jean Dupont" },
    linkedClient: null,
    sourceLabel: "Booking",
  }), "Booking - Jean Dupont");
  assert.equal(helpers.getExternalTitle({
    reservation: { guest_name: "Client Booking" },
    linkedClient: null,
    sourceLabel: "Booking",
  }), "Booking - Infos à compléter");
});
