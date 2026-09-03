import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { submitPublicBooking } from "../src/utils/publicBookingSubmission.js";
import { createSupabaseAtomicBookingRepository, runAtomicPublicBookingWorkflow } from "../netlify/functions/_lib/public-booking-request.js";

const migration = "supabase/migrations/202609030001_revoke_anon_booking_insert.sql";

// Scope guard only; actual PostgreSQL permissions are exercised by the companion .postgres.sql.
test("anonymous booking hardening changes only the obsolete INSERT grant and named policy", () => {
  assert.equal(existsSync(migration), true, "the targeted hardening migration must exist");
  const statements = readFileSync(migration, "utf8").replace(/--[^\n]*/g, "")
    .split(";").map((statement) => statement.trim().replace(/\s+/g, " ")).filter(Boolean);
  assert.deepEqual(statements, [
    "revoke insert on table public.booking_requests from anon",
    'drop policy if exists "Allow public insert booking requests" on public.booking_requests',
  ]);
});

test("the public submission still reaches only the server RPC and sends emails after creation", async () => {
  const order = [];
  const repository = createSupabaseAtomicBookingRepository({
    async rpc(name, params) {
      assert.equal(name, "create_public_booking_request_atomic");
      assert.equal(params.p_booking.status, "pending");
      order.push("rpc");
      return { data: [{ outcome: "created", booking_id: "booking-1" }], error: null };
    },
    from() { assert.fail("public creation must not use a direct table insertion"); },
  });
  const outcome = await submitPublicBooking({ guestFirstName: "Alice" }, {
    async fetchImpl(url, options) {
      assert.equal(url, "/api/booking-request");
      assert.equal(options.method, "POST");
      assert.equal(JSON.parse(options.body).guestFirstName, "Alice");
      const result = await runAtomicPublicBookingWorkflow({
        repository,
        validated: { booking: { status: "pending" }, emailModel: {} },
        buildEmails: () => ({ owner: {}, guest: {} }),
        deliverEmail: async (_email, _id, kind) => order.push(kind),
      });
      return { ok: true, status: 200, json: async () => ({ success: true, bookingId: result.bookingId }) };
    },
  });
  assert.equal(outcome.success, true);
  assert.deepEqual(order, ["rpc", "booking_request:owner", "booking_request:guest"]);
});
