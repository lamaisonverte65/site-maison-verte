import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const presentation = await import("../src/components/admin/calendar/externalConflictPresentation.js").catch(() => ({}));
const {
  findLocalBookingForConflict,
  getExternalConflictDisplayState,
  normalizeOpenExternalConflicts,
  shouldLoadExternalConflicts,
} = presentation;

const openRow = {
  id: "conflict-1",
  status: "open",
  source: "booking",
  externalStartDate: "2026-10-10",
  externalEndDate: "2026-10-15",
  localKind: "booking_request",
  localId: "booking-1",
  localStartDate: "2026-10-12",
  localEndDate: "2026-10-16",
  occurrenceCount: 2,
  guestEmail: "secret@example.test",
  ownerPrice: 900,
};

test("zero or resolved conflicts produce no current admin alert", () => {
  assert.equal(typeof normalizeOpenExternalConflicts, "function");
  assert.deepEqual(normalizeOpenExternalConflicts([]), []);
  assert.deepEqual(normalizeOpenExternalConflicts([{ ...openRow, status: "resolved" }]), []);
});

test("an endpoint failure is unavailable state and never verified zero conflicts", () => {
  assert.equal(typeof getExternalConflictDisplayState, "function");
  const state = getExternalConflictDisplayState([], "Endpoint indisponible");
  assert.deepEqual(state, {
    kind: "unavailable",
    message: "Impossible de vérifier les conflits actuellement.",
    verifiedNoConflicts: false,
  });
  assert.notEqual(state.kind, "clear");
});

test("an open conflict is projected to the minimal display contract", () => {
  const result = normalizeOpenExternalConflicts([openRow]);
  assert.deepEqual(result, [{
    id: "conflict-1",
    source: "booking",
    externalStartDate: "2026-10-10",
    externalEndDate: "2026-10-15",
    localKind: "booking_request",
    localId: "booking-1",
    localStartDate: "2026-10-12",
    localEndDate: "2026-10-16",
    occurrenceCount: 2,
  }]);
  assert.doesNotMatch(JSON.stringify(result), /secret@example|ownerPrice|900/);
});

test("only the owner calendar mode loads external conflicts", () => {
  assert.equal(typeof shouldLoadExternalConflicts, "function");
  assert.equal(shouldLoadExternalConflicts("admin"), true);
  assert.equal(shouldLoadExternalConflicts("housekeeping"), false);
});

test("a booking conflict resolves to its existing local calendar reservation", () => {
  assert.equal(typeof findLocalBookingForConflict, "function");
  const reservation = { id: "booking-1", guest_first_name: "Alice" };
  const events = [{
    id: "booking-1",
    extendedProps: { type: "booking_request", reservation },
  }];
  assert.equal(findLocalBookingForConflict(openRow, events), reservation);
  assert.equal(findLocalBookingForConflict({ ...openRow, localKind: "calendar_block" }, events), null);
});

test("CalendarAdmin reuses the compact conflict dialog and exposes load failures", () => {
  const admin = readFileSync("src/components/CalendarAdmin.jsx", "utf8");
  const dialog = readFileSync("src/components/calendar/CalendarConflictDialog.jsx", "utf8");
  const presentationSource = readFileSync("src/components/admin/calendar/externalConflictPresentation.js", "utf8");
  assert.match(admin, /get-external-occupancy-conflicts/);
  assert.match(admin, /shouldLoadExternalConflicts\(mode\)/);
  assert.match(admin, /<CalendarConflictDialog/);
  assert.match(admin, /externalConflictError/);
  assert.match(admin, /catch \(error\) \{[\s\S]*?setExternalConflicts\(\[\]\);[\s\S]*?setExternalConflictError/);
  assert.match(presentationSource, /Alerte : chevauchement Booking\/Airbnb détecté/);
  assert.match(dialog, /displayState\.message/);
  assert.match(dialog, /onOpenLocal/);
  assert.doesNotMatch(dialog, /annuler|rembourser|priorité automatique/i);
});
