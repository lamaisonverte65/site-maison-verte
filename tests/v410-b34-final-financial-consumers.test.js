import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("B3.4 initial acceptance delegates financial preparation to the server", () => {
  const source = read("src/services/bookingActionsService.js");
  assert.match(source, /prepare-initial-checkout-booking/);
  assert.doesNotMatch(source, /estimatedTotal - total/);
});

test("B3.4 server acceptance preserves the V4.10 tax snapshot and adjusts accommodation only", () => {
  const source = read("netlify/functions/prepare-initial-checkout-booking.js");
  assert.match(source, /buildV410AcceptanceFinancials/);
  assert.doesNotMatch(source, /calculatePublicBookingQuote/);
  assert.doesNotMatch(source, /quoteToBookingMoney/);
  assert.match(source, /canMutateReservationData\(auth\)/);
});

test("B3.4 accept modal shows current accommodation separately and leaves special price empty", () => {
  const admin = read("src/pages/Admin.jsx");
  const ui = read("src/components/admin/AdminUi.jsx");
  assert.match(admin, /currentAccommodationPrice:/);
  assert.match(admin, /price:\s*""/);
  assert.match(ui, /Tarif hébergement actuel/);
  assert.match(ui, /Tarif spécial hébergement/);
});


test("B3.4 pending requests display authoritative total without estimatif wording", () => {
  const source = read("src/components/admin/RequestsPanel.jsx");
  assert.match(source, />Total</);
  assert.match(source, /request\.contract_total \?\? request\.owner_price \?\? request\.estimated_total/);
  assert.doesNotMatch(source, /Total estimatif/);
});

test("B3.4 public quote exposes authoritative deposit rate and amount", () => {
  const source = read("netlify/functions/booking-quote.js");
  assert.match(source, /depositRate: quote\.depositRate/);
  assert.match(source, /depositAmount: centsToEuros\(quote\.depositCents\)/);
});

test("B3.4 public page consumes authoritative deposit quote", () => {
  const source = read("src/pages/MaisonVerte.jsx");
  assert.match(source, /bookingQuote\?\.depositRate/);
  assert.match(source, /bookingQuote\.depositAmount/);
  assert.doesNotMatch(source, /depositBase \* 30/);
  assert.doesNotMatch(source, /Acompte à régler \(30 %\)/);
});

test("B3.4 request email uses snapshotted deposit rate and no estimatif wording", () => {
  const publicBooking = read("netlify/functions/_lib/public-booking.js");
  const sender = read("netlify/functions/send-booking-request.js");
  assert.match(sender, /validated\.emailModel\.depositRate = quote\.depositRate/);
  assert.match(publicBooking, /model\.depositRate/);
  assert.doesNotMatch(publicBooking, /Total estimatif/);
  assert.doesNotMatch(publicBooking, /Acompte de 30 %/);
});
