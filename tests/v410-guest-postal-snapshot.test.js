import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const migration = read("supabase/migrations/202610010002_v410_guest_postal_snapshot.sql");
const publicBooking = read("netlify/functions/_lib/public-booking.js");
const publicForm = read("src/pages/MaisonVerte.jsx");
const summary = read("src/components/admin/reservation/ReservationSummaryBlock.jsx");
const updateBooking = read("netlify/functions/update-booking-request.js");

test("la migration ajoute le CRM postal et le snapshot réservation sans backfill", () => {
  assert.match(migration, /alter table public\.customers[\s\S]*add column if not exists address text[\s\S]*add column if not exists postal_code text/);
  assert.match(migration, /alter table public\.booking_requests[\s\S]*guest_address text[\s\S]*guest_postal_code text[\s\S]*guest_city text[\s\S]*guest_country text/);
  assert.doesNotMatch(migration, /update\s+public\.(customers|booking_requests)/i);
});

test("la création atomique persiste les quatre champs postaux", () => {
  for (const field of ["guest_address", "guest_postal_code", "guest_city", "guest_country"]) {
    assert.match(migration, new RegExp(field));
    assert.match(migration, new RegExp(`p_booking ->> '${field}'`));
  }
});

test("le fingerprint public ne dépend pas de l'adresse", () => {
  const fingerprintBlock = publicBooking.match(/export function createPublicBookingFingerprint[\s\S]*?return createHash/)[0];
  assert.doesNotMatch(fingerprintBlock, /guest_address|guest_postal_code|guest_city|guest_country/);
});

test("le formulaire public collecte et transmet les coordonnées postales", () => {
  for (const token of ["guestAddress", "guestPostalCode", "guestCity", "guestCountry"]) assert.match(publicForm, new RegExp(token));
  assert.match(publicForm, /autoComplete="street-address"/);
  assert.match(publicForm, /autoComplete="postal-code"/);
});

test("la fiche réservation affiche le snapshot postal", () => {
  assert.match(summary, /guest_address/);
  assert.match(summary, /guest_postal_code/);
  assert.match(summary, /guest_city/);
  assert.match(summary, /guest_country/);
});

test("un client existant n'est enrichi que lorsque ses champs postaux sont vides", () => {
  assert.match(updateBooking, /!cleanText\(existingCustomer\.address\) && address/);
  assert.match(updateBooking, /!cleanText\(existingCustomer\.postal_code\) && postalCode/);
  assert.match(updateBooking, /!cleanText\(existingCustomer\.city\) && city/);
  assert.match(updateBooking, /!cleanText\(existingCustomer\.country\) && country/);
});
