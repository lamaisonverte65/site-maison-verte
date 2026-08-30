import test from "node:test";
import assert from "node:assert/strict";

process.env.VITE_SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role";

const externalCustomerModule = await import("../netlify/functions/update-external-reservation-client.js");

test("external customer email normalization handles normal, mixed-case, and empty values", () => {
  const normalize = externalCustomerModule.normalizeExternalCustomerPayload;
  assert.equal(typeof normalize, "function");
  assert.equal(normalize({ email: "alice@example.test" }).email, "alice@example.test");
  assert.equal(normalize({ email: "  Alice@Example.TEST  " }).email, "alice@example.test");
  assert.equal(normalize({ email: "" }).email, null);
  assert.equal(normalize({ email: null }).email, null);
});

test("a normal Booking or Airbnb customer modification keeps its business fields", () => {
  const normalize = externalCustomerModule.normalizeExternalCustomerPayload;
  assert.equal(typeof normalize, "function");
  assert.deepEqual(normalize({
    uid: "booking-uid-42",
    source: "booking",
    firstName: " Alice ",
    lastName: " Martin ",
    email: " Alice@Example.TEST ",
    phone: " +33 6 12 34 56 78 ",
    startDate: "2026-10-10",
    endDate: "2026-10-13",
  }), {
    uid: "booking-uid-42",
    source: "booking",
    firstName: "Alice",
    lastName: "Martin",
    email: "alice@example.test",
    phone: "+33 6 12 34 56 78",
    startDate: "2026-10-10",
    endDate: "2026-10-13",
  });
});

test("external enrichment persistence uses only audited production columns", () => {
  const row = externalCustomerModule.buildExternalReservationRow({
    uid: "booking-uid-42",
    source: "booking",
    startDate: "2026-10-10",
    endDate: "2026-10-13",
    firstName: "Alice",
    lastName: "Martin",
    email: "alice@example.test",
    phone: "+33612345678",
    arrivalTime: "16:00",
    childrenCount: 2,
    babyBedNeeded: true,
    notes: "Préparer le lit enfant.",
  }, { id: 42 }, "2026-08-28T12:00:00.000Z");

  assert.deepEqual(row, {
    uid: "booking-uid-42",
    source: "booking",
    start_date: "2026-10-10",
    end_date: "2026-10-13",
    customer_id: 42,
    guest_first_name: "Alice",
    guest_last_name: "Martin",
    guest_email: "alice@example.test",
    guest_phone: "+33612345678",
    notes: "Préparer le lit enfant.\nHeure d'arrivée : 16:00\nNombre d'enfants : 2\nLit bébé : oui",
    housekeeping_notes: "Préparer le lit enfant.",
    updated_at: "2026-08-28T12:00:00.000Z",
  });
  assert.equal(Object.hasOwn(row, "arrival_time"), false);
  assert.equal(Object.hasOwn(row, "children_count"), false);
  assert.equal(Object.hasOwn(row, "baby_bed_needed"), false);
});
