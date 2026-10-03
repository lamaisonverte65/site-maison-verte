import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("decision email browser contract sends only booking id type and owner message", () => {
  const source = read("src/services/bookingActionsService.js");
  const fn = source.match(/export async function sendDecisionEmail[\s\S]*?\n}/)?.[0] || "";
  assert.match(fn, /bookingId:\s*request\.id/);
  assert.match(fn, /type,/);
  assert.match(fn, /ownerMessage/);
  assert.doesNotMatch(fn, /guestEmail|startDate|paymentLink|paymentAmount|daysBeforeArrival/);
});

test("decision email builds accepted stay and payment data from stored booking", () => {
  const source = read("netlify/functions/send-booking-decision.js");
  assert.match(source, /storedBooking\.guest_first_name/);
  assert.match(source, /storedBooking\.start_date/);
  assert.match(source, /storedBooking\.payment_link/);
  assert.match(source, /storedBooking\.acceptance_expires_at/);
  assert.match(source, /storedBooking\.accommodation_net/);
  assert.match(source, /storedBooking\.tourist_tax_amount/);
});
