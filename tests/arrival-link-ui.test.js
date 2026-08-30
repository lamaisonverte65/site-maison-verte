import test from "node:test";
import assert from "node:assert/strict";

const arrivalUi = await import("../src/utils/arrivalLink.js").catch(() => ({}));

test("an old booking-only arrival link is detected without enabling mutation", () => {
  assert.equal(typeof arrivalUi.getArrivalLinkMode, "function");
  assert.equal(arrivalUi.getArrivalLinkMode({ bookingId: "booking-a", token: "" }), "recovery");
  assert.equal(arrivalUi.getArrivalLinkMode({ bookingId: "", token: "" }), "invalid");
  assert.equal(arrivalUi.getArrivalLinkMode({ bookingId: "booking-a", token: "a".repeat(64) }), "secure");
});
