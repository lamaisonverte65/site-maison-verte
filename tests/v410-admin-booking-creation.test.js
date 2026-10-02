import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("B3.3 admin site creation uses the central V4.10 quote engine", () => {
  const source = read("netlify/functions/create-personal-booking.js");
  assert.match(source, /calculatePublicBookingQuote\(supabase/);
  assert.match(source, /quoteToBookingMoney\(quote\)/);
  assert.doesNotMatch(source, /Math\.round\(total \* 0\.3\)/);
});

test("B3.3 manual admin amount is accommodation-only financial context", () => {
  const source = read("netlify/functions/create-personal-booking.js");
  assert.match(source, /accommodationGrossCents: Math\.round\(specialAccommodation \* 100\)/);
  assert.match(source, /financialSnapshot\.contract_total/);
});

test("B3.3 checkout consumes snapshotted contract total and deposit", () => {
  const source = read("netlify/functions/create-personal-booking.js");
  assert.match(source, /Number\(booking\.contract_total\)/);
  assert.match(source, /Number\(booking\.deposit_amount\)/);
  assert.doesNotMatch(source, /const depositAmount = Math\.round\(total \* 0\.3\)/);
});

test("B3.3 admin form labels the manual amount as accommodation price", () => {
  const source = read("src/components/admin/calendar/SelectionPanel.jsx");
  assert.match(source, /Tarif spécial hébergement/);
  assert.match(source, /forfait ménage/);
  assert.match(source, /Code promotion/);
});

test("B3.3 calendar sends cleaning promotion and payment preference", () => {
  const source = read("src/components/CalendarAdmin.jsx");
  assert.match(source, /cleaningOption: selectionForm\.cleaningOption !== false/);
  assert.match(source, /promotionCode: selectionForm\.promotionCode/);
  assert.match(source, /paymentPreference: selectionForm\.paymentPreference/);
});

test("B3.3 admin financial formatter prefers V4.10 contract total", () => {
  const source = read("src/utils/adminFormatters.js");
  assert.match(source, /request\.contract_total/);
  assert.match(source, /isV410/);
  assert.match(source, /contract_total \?\? request\?\.gross_amount/);
});

test("B3.3 legacy 30 percent fallback remains scoped to non-V4.10 formatter data", () => {
  const source = read("src/utils/adminFormatters.js");
  assert.match(source, /isV410 \? 0 : Math\.round\(total \* 0\.3\)/);
});

test("B3.3 special accommodation total is distributed across nights before tax", () => {
  const source = read("netlify/functions/_lib/booking-quote.js");
  assert.match(source, /distributeTotalAcrossNights/);
  assert.match(source, /financialContext\.accommodationGrossCents/);
});
