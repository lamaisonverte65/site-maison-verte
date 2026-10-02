import { applyDiscountToNightlyAccommodation, applyPercentageDiscountCents, calculateTouristTaxStay, centsToEuros, eurosToCents } from "./tourist-tax.js";
import { getStayNightKeys, loadTouristTaxRulesForStay } from "./tourist-tax-rules.js";

const PROMO_PATTERN = /^[A-Z0-9_-]{1,40}$/;

function normalizePromotionCode(value) {
  return String(value || "").trim().toUpperCase();
}

function dateApplies(date, from, to) {
  return (!from || from <= date) && (!to || to >= date);
}

async function loadPricing(supabase, context = {}) {
  const [{ data: settings, error: settingsError }, { data: seasons, error: seasonsError }, { data: overrides, error: overridesError }] = await Promise.all([
    supabase.from("pricing_settings").select("default_night_price,cleaning_fee,deposit_rate,tourist_tax_classification").eq("id", "default").maybeSingle(),
    supabase.from("season_prices").select("start_date,end_date,night_price,is_active").eq("is_active", true).order("start_date", { ascending: true }),
    supabase.from("price_overrides").select("start_date,end_date,night_price,is_active").eq("is_active", true).order("start_date", { ascending: true }),
  ]);
  if (settingsError) throw settingsError;
  if (seasonsError) throw seasonsError;
  if (overridesError) throw overridesError;

  const defaultNightCents = eurosToCents(settings?.default_night_price ?? 80);
  const cleaningFeeCents = Number.isInteger(context.cleaningFeeCents) && context.cleaningFeeCents >= 0
    ? context.cleaningFeeCents
    : eurosToCents(settings?.cleaning_fee ?? 50);
  const depositRate = context.depositRate !== undefined ? Number(context.depositRate) : Number(settings?.deposit_rate);
  if (!Number.isFinite(depositRate) || depositRate < 0 || depositRate > 1) {
    throw new Error("Taux d’acompte invalide.");
  }
  const touristTaxClassification = String(context.touristTaxClassification || settings?.tourist_tax_classification || "");
  if (!new Set(["unclassified", "1_star", "2_star", "3_star"]).has(touristTaxClassification)) {
    throw new Error("Classement taxe de séjour invalide.");
  }
  return { defaultNightCents, cleaningFeeCents, depositRate, touristTaxClassification, seasons: seasons || [], overrides: overrides || [] };
}

function distributeTotalAcrossNights(totalCents, weights) {
  if (!Number.isInteger(totalCents) || totalCents < 0 || !weights.length) return weights;
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (weightTotal <= 0) {
    const base = Math.floor(totalCents / weights.length);
    const remainder = totalCents - base * weights.length;
    return weights.map((_, index) => base + (index < remainder ? 1 : 0));
  }
  const raw = weights.map((value) => totalCents * value / weightTotal);
  const floors = raw.map(Math.floor);
  let remainder = totalCents - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i += 1) floors[order[i].index] += 1;
  return floors;
}

function nightlyGrossPrices(nights, pricing) {
  return nights.map((night) => {
    const override = pricing.overrides.find((row) => night >= row.start_date && night < row.end_date);
    if (override) return eurosToCents(override.night_price);
    const season = pricing.seasons.find((row) => night >= row.start_date && night < row.end_date);
    if (season) return eurosToCents(season.night_price);
    return pricing.defaultNightCents;
  });
}

async function loadPromotion(supabase, code, nowDate) {
  if (!code) return null;
  if (!PROMO_PATTERN.test(code)) return null;
  const { data, error } = await supabase
    .from("promotion_rules")
    .select("code,discount_basis_points,applies_to,effective_from,effective_to,is_active")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.applies_to !== "accommodation" || !dateApplies(nowDate, data.effective_from, data.effective_to)) return null;
  return data;
}

export async function calculatePublicBookingQuote(supabase, {
  startDate,
  endDate,
  adultsCount,
  childrenCount = 0,
  cleaningOption = true,
  promotionCode = "",
  now = new Date(),
  financialContext = {},
} = {}) {
  const adults = Number(adultsCount);
  const children = Number(childrenCount || 0);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 4) {
    throw new Error("Composition des voyageurs invalide.");
  }
  if (typeof cleaningOption !== "boolean") throw new Error("Option ménage invalide.");

  const nights = getStayNightKeys(startDate, endDate);
  const pricing = await loadPricing(supabase, financialContext);
  const tariffNightlyCents = nightlyGrossPrices(nights, pricing);
  const specialAccommodationCents = financialContext.accommodationGrossCents;
  if (specialAccommodationCents !== undefined && (!Number.isInteger(specialAccommodationCents) || specialAccommodationCents < 0)) {
    throw new Error("Tarif spécial d’hébergement invalide.");
  }
  const grossNightlyCents = specialAccommodationCents === undefined
    ? tariffNightlyCents
    : distributeTotalAcrossNights(specialAccommodationCents, tariffNightlyCents);
  const accommodationGrossCents = grossNightlyCents.reduce((sum, value) => sum + value, 0);

  const requestedPromotionCode = normalizePromotionCode(promotionCode);
  const preservedPromotion = financialContext.promotion && Number.isInteger(financialContext.promotion.discountBasisPoints)
    ? {
        code: normalizePromotionCode(financialContext.promotion.code),
        discount_basis_points: financialContext.promotion.discountBasisPoints,
        applies_to: "accommodation",
      }
    : null;
  const promotion = preservedPromotion || await loadPromotion(supabase, requestedPromotionCode, now.toISOString().slice(0, 10));
  const discount = promotion
    ? applyPercentageDiscountCents(accommodationGrossCents, promotion.discount_basis_points)
    : { grossCents: accommodationGrossCents, discountCents: 0, netCents: accommodationGrossCents };
  const netNightlyCents = promotion
    ? applyDiscountToNightlyAccommodation(grossNightlyCents, promotion.discount_basis_points)
    : grossNightlyCents;

  const rulesByNight = await loadTouristTaxRulesForStay(supabase, { startDate, endDate, classification: pricing.touristTaxClassification });
  const touristTax = calculateTouristTaxStay({
    nightlyAccommodationCents: netNightlyCents,
    occupants: adults + children,
    taxablePeople: adults,
    rulesByNight,
  });
  const cleaningAppliedCents = cleaningOption ? pricing.cleaningFeeCents : 0;
  const depositBasisCents = discount.netCents + cleaningAppliedCents;
  const depositCents = Math.round(depositBasisCents * pricing.depositRate);
  const totalCents = depositBasisCents + touristTax.totalTaxCents;

  return {
    nights,
    accommodationGrossCents,
    promotion: promotion ? { code: promotion.code, discountBasisPoints: promotion.discount_basis_points, discountCents: discount.discountCents } : null,
    accommodationNetCents: discount.netCents,
    cleaningFeeCents: pricing.cleaningFeeCents,
    cleaningAppliedCents,
    touristTaxCents: touristTax.totalTaxCents,
    depositRate: pricing.depositRate,
    depositBasisCents,
    depositCents,
    contractTotalCents: totalCents,
    totalCents,
    touristTaxSnapshot: {
      version: "v4.10-2026-09-28",
      classification: pricing.touristTaxClassification,
      collector: "la_maison_verte",
      occupants: adults + children,
      taxablePeople: adults,
      exemptPeople: children,
      nights: touristTax.nights.map((night, index) => ({ date: nights[index], ...night })),
      totalTaxCents: touristTax.totalTaxCents,
    },
  };
}

export function quoteToBookingMoney(quote) {
  return {
    accommodation_gross: centsToEuros(quote.accommodationGrossCents),
    promotion_code: quote.promotion?.code || null,
    promotion_discount_rate: quote.promotion ? quote.promotion.discountBasisPoints / 10000 : null,
    promotion_discount_amount: quote.promotion ? centsToEuros(quote.promotion.discountCents) : null,
    accommodation_net: centsToEuros(quote.accommodationNetCents),
    tourist_tax_amount: centsToEuros(quote.touristTaxCents),
    tourist_tax_collector: "la_maison_verte",
    tourist_tax_snapshot: quote.touristTaxSnapshot,
    deposit_rate: quote.depositRate,
    deposit_basis: centsToEuros(quote.depositBasisCents),
    deposit_amount: centsToEuros(quote.depositCents),
    contract_total: centsToEuros(quote.contractTotalCents),
    estimated_total: centsToEuros(quote.contractTotalCents),
  };
}
