import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { calculatePublicBookingQuote } from "../netlify/functions/_lib/booking-quote.js";

const update = fs.readFileSync("netlify/functions/update-booking-request.js", "utf8");
const quoteSource = fs.readFileSync("netlify/functions/_lib/booking-quote.js", "utf8");

function queryResult(data) {
  const query = {
    select() { return query; },
    eq() { return query; },
    order() { return query; },
    maybeSingle() { return Promise.resolve({ data, error: null }); },
    then(resolve, reject) { return Promise.resolve({ data, error: null }).then(resolve, reject); },
  };
  return query;
}

function pricingSupabase() {
  return {
    from(table) {
      if (table === "pricing_settings") {
        return queryResult({ default_night_price: 100, cleaning_fee: 50, deposit_rate: 0.3, tourist_tax_classification: "3_star" });
      }
      if (table === "season_prices" || table === "price_overrides") return queryResult([]);
      if (table === "tourist_tax_rules") throw new Error("live tourist-tax catalog must not be read when historical rules are provided");
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const historicalRule = {
  id: "historical-3-star",
  classification: "3_star",
  calculationType: "fixed",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  fixedRateCents: 230,
};

test("V4.13 booking edit quote uses preserved historical tourist-tax rules without reading the live catalog", async () => {
  const result = await calculatePublicBookingQuote(pricingSupabase(), {
    startDate: "2026-10-20",
    endDate: "2026-10-22",
    adultsCount: 2,
    childrenCount: 0,
    cleaningOption: false,
    financialContext: {
      depositRate: 0.3,
      touristTaxClassification: "3_star",
      cleaningFeeCents: 5000,
      touristTaxRules: [historicalRule],
    },
  });

  assert.equal(result.touristTaxCents, 920);
  assert.equal(result.touristTaxSnapshot.nights[0].rule.id, "historical-3-star");
});



test("V4.13 booking edit fails closed when the historical snapshot does not cover the new stay dates", async () => {
  const endedHistoricalRule = { ...historicalRule, effectiveTo: "2026-10-19" };
  await assert.rejects(
    calculatePublicBookingQuote(pricingSupabase(), {
      startDate: "2026-10-20",
      endDate: "2026-10-22",
      adultsCount: 2,
      childrenCount: 0,
      cleaningOption: false,
      financialContext: {
        depositRate: 0.3,
        touristTaxClassification: "3_star",
        cleaningFeeCents: 5000,
        touristTaxRules: [endedHistoricalRule],
      },
    }),
    /Aucune règle de taxe de séjour applicable au 2026-10-20/,
  );
});

test("V4.13 booking edit passes rules captured in the original tourist-tax snapshot", () => {
  assert.match(update, /function historicalTouristTaxRules\s*\(/);
  assert.match(update, /touristTaxRules:\s*historicalTouristTaxRules\(taxSnapshot\)/);
  assert.match(update, /Snapshot historique de taxe de séjour[^\n]*règle/i);
});

test("V4.13 explicit historical rules never fall back silently to the live rule catalog", () => {
  assert.match(quoteSource, /Object\.prototype\.hasOwnProperty\.call\(financialContext,\s*["']touristTaxRules["']\)/);
  assert.match(quoteSource, /resolveTouristTaxRulesByNight/);
});
