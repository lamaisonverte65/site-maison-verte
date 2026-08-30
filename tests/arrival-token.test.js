import test from "node:test";
import assert from "node:assert/strict";
import * as arrivalToken from "../netlify/functions/_lib/arrival-token.js";

const { createArrivalToken, hashArrivalToken, verifyArrivalCapability } = arrivalToken;

const now = new Date("2026-10-10T10:00:00.000Z");
const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);
const eligibleBooking = {
  id: "booking-a",
  status: "confirmed",
  start_date: "2026-10-11",
  end_date: "2026-10-14",
  arrival_token_hash: hashArrivalToken(tokenA),
  arrival_token_expires_at: "2026-10-14T23:59:59.999Z",
};

test("bookingId alone is insufficient", () => {
  const result = verifyArrivalCapability({ booking: eligibleBooking, bookingId: "booking-a", token: "", arrivalTime: "17:30", now });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 403);
});

test("a valid token accepts a strict HH:MM time", () => {
  const result = verifyArrivalCapability({ booking: eligibleBooking, bookingId: "booking-a", token: tokenA, arrivalTime: "17:30", now });
  assert.deepEqual(result, { ok: true, arrivalTime: "17:30" });
});

test("invalid and cross-booking tokens are refused", () => {
  assert.equal(verifyArrivalCapability({ booking: eligibleBooking, bookingId: "booking-a", token: tokenB, arrivalTime: "17:30", now }).ok, false);
  const otherBooking = { ...eligibleBooking, id: "booking-b", arrival_token_hash: hashArrivalToken(tokenB) };
  assert.equal(verifyArrivalCapability({ booking: otherBooking, bookingId: "booking-b", token: tokenA, arrivalTime: "17:30", now }).ok, false);
});

test("expired tokens are refused", () => {
  const booking = { ...eligibleBooking, arrival_token_expires_at: "2026-10-09T23:59:59.999Z" };
  assert.equal(verifyArrivalCapability({ booking, bookingId: booking.id, token: tokenA, arrivalTime: "17:30", now }).statusCode, 410);
});

test("invalid time formats are refused", () => {
  for (const arrivalTime of ["17h30", "7:30", "24:00", "17:75", "<script>"]) {
    assert.equal(verifyArrivalCapability({ booking: eligibleBooking, bookingId: "booking-a", token: tokenA, arrivalTime, now }).ok, false);
  }
});

test("cancelled, refused, pending, and completed stays are refused", () => {
  for (const status of ["cancelled", "refused", "pending", "expired"]) {
    const booking = { ...eligibleBooking, status };
    assert.equal(verifyArrivalCapability({ booking, bookingId: booking.id, token: tokenA, arrivalTime: "17:30", now }).ok, false);
  }
  const ended = { ...eligibleBooking, end_date: "2026-10-09" };
  assert.equal(verifyArrivalCapability({ booking: ended, bookingId: ended.id, token: tokenA, arrivalTime: "17:30", now }).ok, false);
});

test("token creation stores a hash and expires with the stay", () => {
  const result = createArrivalToken({ id: "booking-a", end_date: "2026-10-14" }, { randomBytes: () => Buffer.alloc(32, 1) });
  assert.equal(result.token.length, 64);
  assert.notEqual(result.hash, result.token);
  assert.equal(result.hash, hashArrivalToken(result.token));
  assert.equal(result.expiresAt, "2026-10-14T23:59:59.999Z");
});

test("a reminder already marked sent is reissued when no usable secure token exists", () => {
  assert.equal(typeof arrivalToken.shouldSendSecureArrivalReminder, "function");
  assert.equal(arrivalToken.shouldSendSecureArrivalReminder({ ...eligibleBooking, arrival_token_hash: null }, { reminderSent: true, now }), true);
  assert.equal(arrivalToken.shouldSendSecureArrivalReminder(eligibleBooking, { reminderSent: true, now }), false);
  assert.equal(arrivalToken.shouldSendSecureArrivalReminder(eligibleBooking, { reminderSent: false, now }), true);
});
