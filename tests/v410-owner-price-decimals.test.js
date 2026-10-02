import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("V4.10 prepare checkout does not copy decimal contract_total into legacy integer owner_price", () => {
  const source = read("netlify/functions/prepare-initial-checkout-booking.js");
  assert.doesNotMatch(source, /owner_price\s*:\s*snapshot\.contract_total/);
  assert.match(source, /gross_amount\s*:\s*snapshot\.contract_total/);
  assert.match(source, /owner_price\s*:\s*legacyTotal/);
});

test("V4.10 booking update does not copy decimal contract_total into legacy integer owner_price", () => {
  const source = read("netlify/functions/update-booking-request.js");
  assert.doesNotMatch(source, /updatePayload\.owner_price\s*=\s*updatePayload\.contract_total/);
  assert.match(source, /updatePayload\.gross_amount\s*=\s*updatePayload\.contract_total/);
  assert.match(source, /updatePayload\.owner_price\s*=\s*legacyTotal/);
});

test("V4.10 personal booking creation leaves legacy owner_price unset", () => {
  const source = read("netlify/functions/create-personal-booking.js");
  assert.doesNotMatch(source, /owner_price\s*:\s*financialSnapshot\.contract_total/);
  assert.match(source, /gross_amount\s*:\s*financialSnapshot\.contract_total/);
  assert.match(source, /estimated_total:\s*0,\s*owner_price:\s*0,\s*gross_amount:\s*0/);
});

test("no V4.10 contract_total-to-owner_price regression remains in supplied netlify/src sources", () => {
  const files = [
    "netlify/functions/prepare-initial-checkout-booking.js",
    "netlify/functions/update-booking-request.js",
    "netlify/functions/create-personal-booking.js",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /owner_price\s*:\s*(?:financialSnapshot|snapshot)\.contract_total/);
    assert.doesNotMatch(source, /owner_price\s*=\s*updatePayload\.contract_total/);
  }
});
