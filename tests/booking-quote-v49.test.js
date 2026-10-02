import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePublicBookingQuote, quoteToBookingMoney } from "../netlify/functions/_lib/booking-quote.js";
import { resolveTouristTaxRulesByNight } from "../netlify/functions/_lib/tourist-tax-rules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, "..", "supabase", "migrations", "202609270002_public_booking_v49_money_snapshot.sql");

const openTaxRule = {
  id: "tax-current",
  effective_from: "2026-01-01",
  effective_to: null,
  classification: "unclassified",
  calculation_type: "proportional",
  base_rate_basis_points: 500,
  department_additional_basis_points: 1000,
  regional_additional_basis_points: 3400,
  base_cap_cents: 460,
  fixed_rate_cents: null,
  is_active: true,
};

function queryResult(value) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    lte() { return builder; },
    or() { return builder; },
    order() { return builder; },
    maybeSingle() { return Promise.resolve(value); },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return builder;
}

function makeSupabase({ defaultNightPrice = 100, cleaningFee = 50, depositRate = 0.30, touristTaxClassification = "unclassified", seasons = [], overrides = [], promotion = null, taxRules = [openTaxRule] } = {}) {
  return {
    from(table) {
      if (table === "pricing_settings") return queryResult({ data: { default_night_price: defaultNightPrice, cleaning_fee: cleaningFee, deposit_rate: depositRate, tourist_tax_classification: touristTaxClassification }, error: null });
      if (table === "season_prices") return queryResult({ data: seasons, error: null });
      if (table === "price_overrides") return queryResult({ data: overrides, error: null });
      if (table === "promotion_rules") return queryResult({ data: promotion, error: null });
      if (table === "tourist_tax_rules") return queryResult({ data: taxRules, error: null });
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

const loyalPromotion = {
  code: "CLIENTFIDELE",
  discount_basis_points: 1000,
  applies_to: "accommodation",
  effective_from: "2026-09-27",
  effective_to: null,
  is_active: true,
};

test("V4.9 public quote is authoritative and uses server pricing priority", async () => {
  const supabase = makeSupabase({
    defaultNightPrice: 80,
    seasons: [{ start_date: "2026-10-01", end_date: "2026-10-04", night_price: 100, is_active: true }],
    overrides: [{ start_date: "2026-10-02", end_date: "2026-10-03", night_price: 120, is_active: true }],
  });
  const quote = await calculatePublicBookingQuote(supabase, {
    startDate: "2026-10-01", endDate: "2026-10-04", adultsCount: 2, cleaningOption: false,
  });
  assert.deepEqual(quote.nights, ["2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.equal(quote.accommodationGrossCents, 32000); // season 100 + override 120 + season 100
});

test("CLIENTFIDELE discounts accommodation only; cleaning stays full price", async () => {
  const quote = await calculatePublicBookingQuote(makeSupabase({ promotion: loyalPromotion }), {
    startDate: "2026-10-01", endDate: "2026-10-03", adultsCount: 2, cleaningOption: true,
    promotionCode: " clientfidele ", now: new Date("2026-10-01T12:00:00Z"),
  });
  assert.equal(quote.accommodationGrossCents, 20000);
  assert.equal(quote.promotion.code, "CLIENTFIDELE");
  assert.equal(quote.promotion.discountCents, 2000);
  assert.equal(quote.accommodationNetCents, 18000);
  assert.equal(quote.cleaningAppliedCents, 5000);
  assert.equal(quote.totalCents, quote.accommodationNetCents + quote.cleaningAppliedCents + quote.touristTaxCents);
});

test("tourist tax is calculated from net accommodation after CLIENTFIDELE", async () => {
  const withoutPromotion = await calculatePublicBookingQuote(makeSupabase(), {
    startDate: "2026-10-01", endDate: "2026-10-02", adultsCount: 2, cleaningOption: false,
  });
  const withPromotion = await calculatePublicBookingQuote(makeSupabase({ promotion: loyalPromotion }), {
    startDate: "2026-10-01", endDate: "2026-10-02", adultsCount: 2, cleaningOption: false,
    promotionCode: "CLIENTFIDELE", now: new Date("2026-10-01T12:00:00Z"),
  });
  assert.equal(withoutPromotion.touristTaxCents, 720);
  assert.equal(withPromotion.touristTaxCents, 650);
});

test("current operational tourist-tax rule remains applicable after 2026 until replaced", () => {
  const rules = resolveTouristTaxRulesByNight({ startDate: "2027-07-10", endDate: "2027-07-12", rules: [openTaxRule] });
  assert.equal(rules.length, 2);
  assert.equal(rules[0].id, "tax-current");
  assert.equal(rules[1].id, "tax-current");
});

test("V4.9 booking money snapshot preserves promotion and tourist-tax evidence", async () => {
  const quote = await calculatePublicBookingQuote(makeSupabase({ promotion: loyalPromotion }), {
    startDate: "2026-10-01", endDate: "2026-10-03", adultsCount: 2, childrenCount: 1,
    cleaningOption: true, promotionCode: "CLIENTFIDELE", now: new Date("2026-10-01T12:00:00Z"),
  });
  const money = quoteToBookingMoney(quote);
  assert.deepEqual(Object.keys(money).sort(), [
    "accommodation_gross", "accommodation_net", "contract_total", "deposit_amount",
    "deposit_basis", "deposit_rate", "estimated_total", "promotion_code",
    "promotion_discount_amount", "promotion_discount_rate", "tourist_tax_amount",
    "tourist_tax_collector", "tourist_tax_snapshot",
  ].sort());
  assert.equal(money.accommodation_gross, 200);
  assert.equal(money.promotion_code, "CLIENTFIDELE");
  assert.equal(money.promotion_discount_rate, 0.1);
  assert.equal(money.promotion_discount_amount, 20);
  assert.equal(money.accommodation_net, 180);
  assert.equal(money.tourist_tax_collector, "la_maison_verte");
  assert.equal(money.tourist_tax_snapshot.classification, "unclassified");
  assert.equal(money.tourist_tax_snapshot.occupants, 3);
  assert.equal(money.tourist_tax_snapshot.taxablePeople, 2);
  assert.equal(money.tourist_tax_snapshot.exemptPeople, 1);
  assert.equal(money.deposit_rate, 0.30);
  assert.equal(money.deposit_basis, money.accommodation_net + 50);
  assert.equal(money.deposit_amount, 69);
  assert.equal(money.contract_total, money.accommodation_net + 50 + money.tourist_tax_amount);
  assert.equal(money.estimated_total, money.contract_total);
});

test("migration 002 opens the validated operational rule and persists every V4.9 money snapshot field atomically", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /set\s+effective_to\s*=\s*null/i);
  assert.match(sql, /effective_from\s*=\s*date\s*'2026-01-01'/i);
  assert.match(sql, /effective_to\s*=\s*date\s*'2026-12-31'/i);
  for (const field of [
    "accommodation_gross", "promotion_code", "promotion_discount_rate", "promotion_discount_amount",
    "accommodation_net", "tourist_tax_amount", "tourist_tax_collector", "tourist_tax_snapshot", "estimated_total",
  ]) {
    assert.match(sql, new RegExp(`\\b${field}\\b`, "i"), `${field} must be persisted by the atomic RPC`);
  }
  assert.match(sql, /revoke all on function public\.create_public_booking_request_atomic[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.create_public_booking_request_atomic[\s\S]*to service_role/i);
});

test("deposit basis is explicitly accommodation net plus selected cleaning, excluding tourist tax", async () => {
  const quote = await calculatePublicBookingQuote(makeSupabase({ promotion: loyalPromotion }), {
    startDate: "2026-10-01", endDate: "2026-10-03", adultsCount: 2, cleaningOption: true,
    promotionCode: "CLIENTFIDELE", now: new Date("2026-10-01T12:00:00Z"),
  });
  assert.equal(quote.depositBasisCents, 23000);
  assert.equal(quote.depositRate, 0.30);
  assert.equal(quote.depositCents, 6900);
  assert.ok(quote.touristTaxCents > 0);
  assert.notEqual(quote.depositCents, Math.round(quote.totalCents * quote.depositRate));
});


test("V4.10 quote snapshots configurable deposit rate and selected tourist-tax classification", async () => {
  const fixedRule = {
    id: "tax-2-star", effective_from: "2026-01-01", effective_to: null,
    classification: "2_star", calculation_type: "fixed",
    base_rate_basis_points: null, department_additional_basis_points: null,
    regional_additional_basis_points: null, base_cap_cents: null,
    fixed_rate_cents: 144, is_active: true,
  };
  const quote = await calculatePublicBookingQuote(makeSupabase({
    depositRate: 0.40, touristTaxClassification: "2_star", taxRules: [openTaxRule, fixedRule],
  }), { startDate: "2026-10-01", endDate: "2026-10-03", adultsCount: 2, childrenCount: 1, cleaningOption: true });
  assert.equal(quote.depositRate, 0.40);
  assert.equal(quote.depositBasisCents, 25000);
  assert.equal(quote.depositCents, 10000);
  assert.equal(quote.touristTaxCents, 576);
  assert.equal(quote.contractTotalCents, 25576);
  assert.equal(quote.touristTaxSnapshot.classification, "2_star");
  assert.ok(quote.touristTaxSnapshot.nights.every((night) => night.rule.classification === "2_star"));
});
