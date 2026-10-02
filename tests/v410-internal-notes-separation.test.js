import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

test("reservation admin edits use internal_notes and keep owner_message as legacy display", () => {
  const panel = read("src/components/admin/ReservationPanel.jsx");
  const update = read("netlify/functions/update-booking-request.js");
  assert.match(panel, /internalNotes: request\.internal_notes \|\| ""/);
  assert.match(update, /existingBooking\.internal_notes/);
  assert.match(update, /internal_notes: internalNotes/);
  assert.doesNotMatch(update, /owner_message: internalNotes/);
});

test("new admin and external bookings no longer write internal notes to owner_message", () => {
  const create = read("netlify/functions/create-personal-booking.js");
  const external = read("netlify/functions/apply-external-calendar-action.js");
  assert.match(create, /internal_notes: internalNotes/);
  assert.match(external, /internal_notes: cleanText\(item\.notes\)/);
  assert.doesNotMatch(create, /owner_message: internalNotes/);
  assert.doesNotMatch(external, /owner_message:/);
});

test("decision, checkout and expiry flows no longer write owner_message", () => {
  const admin = read("src/pages/Admin.jsx");
  const checkout = read("netlify/functions/prepare-initial-checkout-booking.js");
  const expiry = read("netlify/functions/check-expired-bookings.js");
  assert.doesNotMatch(admin, /owner_message:\s*values\.message/);
  assert.doesNotMatch(checkout, /owner_message:/);
  assert.doesNotMatch(expiry, /owner_message:/);
});

test("migration adds internal_notes without migrating legacy values and stops refund RPC writes", () => {
  const migration = read("supabase/migrations/202610010001_v410_internal_notes.sql");
  assert.match(migration, /add column if not exists internal_notes text/);
  assert.doesNotMatch(migration, /set\s+internal_notes\s*=\s*owner_message/i);
  assert.doesNotMatch(migration, /owner_message\s*=/i);
  assert.match(migration, /refund_reason/);
  assert.match(migration, /booking_events/);
});
