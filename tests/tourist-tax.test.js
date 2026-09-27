import test from "node:test";
import assert from "node:assert/strict";
import {
  applyDiscountToNightlyAccommodation,
  applyPercentageDiscountCents,
  calculateTouristTaxNight,
  calculateTouristTaxStay,
} from "../netlify/functions/_lib/tourist-tax.js";

const unclassified2026 = {
  id: "rule-2026-unclassified",
  classification: "unclassified",
  calculation_type: "proportional",
  effective_from: "2026-01-01",
  effective_to: "2026-12-31",
  base_rate_basis_points: 500,
  department_additional_basis_points: 1000,
  regional_additional_basis_points: 3400,
  base_cap_cents: 460,
};

test("Aure-Louron proportional example rounds every step to the cent", () => {
  const result = calculateTouristTaxNight({ accommodationCents: 5400, occupants: 4, taxablePeople: 2, rule: unclassified2026 });
  assert.equal(result.baseTaxCents, 68);
  assert.equal(result.cappedBaseTaxCents, 68);
  assert.equal(result.departmentTaxCents, 7);
  assert.equal(result.regionalTaxCents, 23);
  assert.equal(result.personNightRateCents, 98);
  assert.equal(result.totalTaxCents, 196);
});

test("the 4.60 euro cap applies before additional taxes", () => {
  const result = calculateTouristTaxNight({ accommodationCents: 50000, occupants: 1, taxablePeople: 1, rule: unclassified2026 });
  assert.equal(result.baseTaxCents, 2500);
  assert.equal(result.cappedBaseTaxCents, 460);
  assert.equal(result.departmentTaxCents, 46);
  assert.equal(result.regionalTaxCents, 156);
  assert.equal(result.personNightRateCents, 662);
});

test("minors remain occupants but are not taxable", () => {
  const result = calculateTouristTaxNight({ accommodationCents: 5400, occupants: 4, taxablePeople: 2, rule: unclassified2026 });
  assert.equal(result.occupants, 4);
  assert.equal(result.taxablePeople, 2);
  assert.equal(result.totalTaxCents, 196);
});

test("fixed classified rates already include additional taxes", () => {
  const result = calculateTouristTaxNight({
    accommodationCents: 10000, occupants: 4, taxablePeople: 2,
    rule: { classification: "2_star", calculation_type: "fixed", effective_from: "2026-01-01", fixed_rate_cents: 144 },
  });
  assert.equal(result.personNightRateCents, 144);
  assert.equal(result.departmentTaxCents, 0);
  assert.equal(result.regionalTaxCents, 0);
  assert.equal(result.totalTaxCents, 288);
});

test("a stay may use a different dated rule for each night", () => {
  const fixed = { classification: "2_star", calculation_type: "fixed", effective_from: "2027-01-01", fixed_rate_cents: 150 };
  const result = calculateTouristTaxStay({
    nightlyAccommodationCents: [10000, 10000], occupants: 2, taxablePeople: 2,
    rulesByNight: [unclassified2026, fixed],
  });
  assert.equal(result.nightsCount, 2);
  assert.equal(result.nights[0].personNightRateCents, 360);
  assert.equal(result.nights[1].personNightRateCents, 150);
  assert.equal(result.totalTaxCents, 1020);
});

test("CLIENTFIDELE foundation applies ten percent to accommodation only", () => {
  assert.deepEqual(applyPercentageDiscountCents(50000, 1000), { grossCents: 50000, discountCents: 5000, netCents: 45000 });
  assert.deepEqual(applyDiscountToNightlyAccommodation([10001, 20002, 19997], 1000).reduce((sum, value) => sum + value, 0), 45000);
});
