import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V4.10 prepare checkout writes only contractual financial fields", () => {
  const source = read("netlify/functions/prepare-initial-checkout-booking.js");
  assert.doesNotMatch(source, /estimated_total\s*:/);
  assert.doesNotMatch(source, /gross_amount\s*:/);
  assert.match(source, /buildV410AcceptanceFinancials/);
  assert.match(source, /owner_price\s*:\s*legacyTotal/);
});

test("V4.10 booking modification does not mirror contract_total into legacy totals", () => {
  const source = read("netlify/functions/update-booking-request.js");
  assert.doesNotMatch(source, /updatePayload\.owner_price\s*=\s*updatePayload\.contract_total/);
  assert.doesNotMatch(source, /updatePayload\.gross_amount\s*=\s*updatePayload\.contract_total/);
});

test("V4.10 personal booking creation does not mirror contract_total into legacy totals", () => {
  const source = read("netlify/functions/create-personal-booking.js");
  assert.doesNotMatch(source, /owner_price\s*:\s*financialSnapshot\.contract_total/);
  assert.doesNotMatch(source, /gross_amount\s*:\s*financialSnapshot\.contract_total/);
  assert.match(source, /estimated_total:\s*0,\s*owner_price:\s*0,\s*gross_amount:\s*0/);
});

test("quoteToBookingMoney no longer emits the legacy estimated_total field", () => {
  const source = read("netlify/functions/_lib/booking-quote.js");
  assert.doesNotMatch(source, /estimated_total\s*:/);
});
