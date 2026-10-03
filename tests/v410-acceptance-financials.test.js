import test from "node:test";
import assert from "node:assert/strict";
import { buildV410AcceptanceFinancials } from "../netlify/functions/_lib/booking-acceptance-financials.js";

const baseBooking = {
  accommodation_gross: 230,
  accommodation_net: 230,
  promotion_code: null,
  promotion_discount_rate: null,
  promotion_discount_amount: null,
  cleaning_option: false,
  cleaning_fee: 50,
  tourist_tax_amount: 8.28,
  tourist_tax_collector: "la_maison_verte",
  tourist_tax_snapshot: { version: "v4.10-test", totalTaxCents: 828 },
  deposit_rate: 0.30,
  deposit_basis: 230,
  deposit_amount: 69,
  contract_total: 238.28,
};

test("acceptance without special price preserves the complete V4.10 financial snapshot", () => {
  const result = buildV410AcceptanceFinancials(baseBooking, null);
  assert.deepEqual(result, {
    accommodation_gross: 230,
    accommodation_net: 230,
    promotion_code: null,
    promotion_discount_rate: null,
    promotion_discount_amount: null,
    tourist_tax_amount: 8.28,
    tourist_tax_collector: "la_maison_verte",
    tourist_tax_snapshot: baseBooking.tourist_tax_snapshot,
    deposit_rate: 0.30,
    deposit_basis: 230,
    deposit_amount: 69,
    contract_total: 238.28,
  });
  assert.equal("estimated_total" in result, false);
  assert.equal("owner_price" in result, false);
  assert.equal("gross_amount" in result, false);
});

test("special price changes accommodation only and preserves snapshotted tourist tax", () => {
  const result = buildV410AcceptanceFinancials(baseBooking, 200);
  assert.equal(result.accommodation_gross, 230);
  assert.equal(result.accommodation_net, 200);
  assert.equal(result.promotion_discount_amount, 30);
  assert.equal(result.promotion_discount_rate, 30 / 230);
  assert.equal(result.promotion_code, null);
  assert.equal(result.tourist_tax_amount, 8.28);
  assert.equal(result.tourist_tax_snapshot, baseBooking.tourist_tax_snapshot);
  assert.equal(result.deposit_basis, 200);
  assert.equal(result.deposit_amount, 60);
  assert.equal(result.contract_total, 208.28);
});

test("special price keeps selected cleaning in deposit basis and contract total", () => {
  const result = buildV410AcceptanceFinancials({ ...baseBooking, cleaning_option: true }, 200);
  assert.equal(result.deposit_basis, 250);
  assert.equal(result.deposit_amount, 75);
  assert.equal(result.contract_total, 258.28);
});

test("special price is a discount and cannot increase the currently applied accommodation", () => {
  assert.throws(() => buildV410AcceptanceFinancials(baseBooking, 240), /supérieur/i);
});

test("manual special price replaces any previous promotion with the actually applied discount", () => {
  const result = buildV410AcceptanceFinancials({
    ...baseBooking,
    accommodation_net: 207,
    promotion_code: "CLIENTFIDELE",
    promotion_discount_rate: 0.10,
    promotion_discount_amount: 23,
    deposit_basis: 207,
    deposit_amount: 62.10,
    contract_total: 215.28,
  }, 200);
  assert.equal(result.accommodation_gross, 230);
  assert.equal(result.accommodation_net, 200);
  assert.equal(result.promotion_code, null);
  assert.equal(result.promotion_discount_amount, 30);
  assert.equal(result.promotion_discount_rate, 30 / 230);
  assert.equal(result.tourist_tax_amount, 8.28);
  assert.equal(result.contract_total, 208.28);
});
