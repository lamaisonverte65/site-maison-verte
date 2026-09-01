import test from "node:test";
import assert from "node:assert/strict";

const atomicModule = await import("../netlify/functions/_lib/public-booking-request.js").catch(() => ({}));
const runAtomicPublicBookingWorkflow = atomicModule.runAtomicPublicBookingWorkflow;

const validated = {
  booking: {
    guest_email: "alice@example.test",
    start_date: "2026-10-10",
    end_date: "2026-10-15",
  },
  emailModel: { firstName: "Alice" },
};

test("date conflict returns without building or delivering booking emails", async () => {
  assert.equal(typeof runAtomicPublicBookingWorkflow, "function");
  let builds = 0;
  const deliveries = [];

  const result = await runAtomicPublicBookingWorkflow({
    validated,
    repository: { createAtomic: async () => ({ outcome: "date_conflict", bookingId: null }) },
    buildEmails() { builds += 1; return {}; },
    async deliverEmail(email, bookingId, emailType) { deliveries.push({ email, bookingId, emailType }); },
  });

  assert.deepEqual(result, { outcome: "date_conflict", bookingId: null });
  assert.equal(builds, 0);
  assert.deepEqual(deliveries, []);
});

test("duplicate returns deterministically without booking emails", async () => {
  let builds = 0;
  const deliveries = [];
  const result = await runAtomicPublicBookingWorkflow({
    validated,
    repository: { createAtomic: async () => ({ outcome: "duplicate", bookingId: null }) },
    buildEmails() { builds += 1; return {}; },
    async deliverEmail(email) { deliveries.push(email); },
  });

  assert.deepEqual(result, { outcome: "duplicate", bookingId: null });
  assert.equal(builds, 0);
  assert.deepEqual(deliveries, []);
});

test("created request delivers owner then guest emails after the atomic creation", async () => {
  const order = [];
  const result = await runAtomicPublicBookingWorkflow({
    validated,
    repository: {
      async createAtomic() {
        order.push("created");
        return { outcome: "created", bookingId: "booking-1" };
      },
    },
    buildEmails() {
      return { owner: { to: "owner@example.test" }, guest: { to: "alice@example.test" } };
    },
    async deliverEmail(email, bookingId, emailType) {
      order.push(`${emailType}:${email.to}:${bookingId}`);
    },
  });

  assert.deepEqual(result, { outcome: "created", bookingId: "booking-1" });
  assert.deepEqual(order, [
    "created",
    "booking_request:owner:owner@example.test:booking-1",
    "booking_request:guest:alice@example.test:booking-1",
  ]);
});

test("email failure keeps the committed booking and reports confirmation pending", async () => {
  const result = await runAtomicPublicBookingWorkflow({
    validated,
    repository: { createAtomic: async () => ({ outcome: "created", bookingId: "booking-1" }) },
    buildEmails: () => ({ owner: { to: "owner@example.test" }, guest: { to: "alice@example.test" } }),
    deliverEmail: async () => { throw new Error("provider unavailable"); },
    onEmailError() {},
  });

  assert.deepEqual(result, {
    outcome: "created",
    bookingId: "booking-1",
    confirmationPending: true,
  });
});

test("RPC response normalization rejects unknown or incomplete outcomes", () => {
  assert.equal(typeof atomicModule.normalizeAtomicBookingResult, "function");
  assert.deepEqual(atomicModule.normalizeAtomicBookingResult([{ outcome: "created", booking_id: "booking-1" }]), {
    outcome: "created",
    bookingId: "booking-1",
  });
  assert.deepEqual(atomicModule.normalizeAtomicBookingResult([{ outcome: "duplicate", booking_id: null }]), {
    outcome: "duplicate",
    bookingId: null,
  });
  assert.throws(() => atomicModule.normalizeAtomicBookingResult([{ outcome: "created", booking_id: null }]), /invalide/i);
  assert.throws(() => atomicModule.normalizeAtomicBookingResult([{ outcome: "unexpected" }]), /invalide/i);
});

test("PostgreSQL exclusion violations are classified as booking date conflicts", () => {
  assert.equal(typeof atomicModule.isBookingDateConflictError, "function");
  assert.equal(atomicModule.isBookingDateConflictError({ code: "23P01" }), true);
  assert.equal(atomicModule.isBookingDateConflictError({ code: "23505" }), false);
  assert.equal(atomicModule.isBookingDateConflictError(new Error("technical detail")), false);
});

test("Supabase atomic repository calls only the RPC and normalizes its business result", async () => {
  assert.equal(typeof atomicModule.createSupabaseAtomicBookingRepository, "function");
  const calls = [];
  const repository = atomicModule.createSupabaseAtomicBookingRepository({
    async rpc(name, parameters) {
      calls.push({ name, parameters });
      return { data: [{ outcome: "created", booking_id: "booking-1" }], error: null };
    },
  });

  const result = await repository.createAtomic({
    booking: { start_date: "2026-10-10", end_date: "2026-10-15" },
    fingerprint: "a".repeat(64),
    now: "2026-09-01T10:00:00.000Z",
  });

  assert.deepEqual(result, { outcome: "created", bookingId: "booking-1" });
  assert.deepEqual(calls, [{
    name: "create_public_booking_request_atomic",
    parameters: {
      p_booking: { start_date: "2026-10-10", end_date: "2026-10-15" },
      p_fingerprint: "a".repeat(64),
      p_now: "2026-09-01T10:00:00.000Z",
    },
  }]);
});
