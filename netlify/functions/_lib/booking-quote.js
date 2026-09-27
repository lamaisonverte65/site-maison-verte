import { applyDiscountToNightlyAccommodation, applyPercentageDiscountCents, calculateTouristTaxStay, centsToEuros, eurosToCents } from "./tourist-tax.js";
import { getStayNightKeys, loadTouristTaxRulesForStay } from "./tourist-tax-rules.js";

const PROMO_PATTERN = /^[A-Z0-9_-]{1,40}$/;

function normalizePromotionCode(value) {
  return String(value || "").trim().toUpperCase();
}

function dateApplies(date, from, to) {
  return (!from || from <= date) && (!to || to >= date);
}

async function loadPricing(supabase) {
  const [{ data: settings, error: settingsError }, { data: seasons, error: seasonsError }, { data: overrides, error: overridesError }] = await Promise.all([
    supabase.from("pricing_settings").select("default_night_price,cleaning_fee").eq("id", "default").maybeSingle(),
    supabase.from("season_prices").select("start_date,end_date,night_price,is_active").eq("is_active", true).order("start_date", { ascending: true }),
    supabase.from("price_overrides").select("start_date,end_date,night_price,is_active").eq("is_active", true).order("start_date", { ascending: true }),
  ]);
  if (settingsError) throw settingsError;
  if (seasonsError) throw seasonsError;
  if (overridesError) throw overridesError;

  const defaultNightCents = eurosToCents(settings?.default_night_price ?? 80);
  const cleaningFeeCents = eurosToCents(settings?.cleaning_fee ?? 50);
  return { defaultNightCents, cleaningFeeCents, seasons: seasons || [], overrides: overrides || [] };
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
} = {}) {
  const adults = Number(adultsCount);
  const children = Number(childrenCount || 0);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 4) {
    throw new Error("Composition des voyageurs invalide.");
  }
  if (typeof cleaningOption !== "boolean") throw new Error("Option ménage invalide.");

  const nights = getStayNightKeys(startDate, endDate);
  const pricing = await loadPricing(supabase);
  const grossNightlyCents = nightlyGrossPrices(nights, pricing);
  const accommodationGrossCents = grossNightlyCents.reduce((sum, value) => sum + value, 0);

  const requestedPromotionCode = normalizePromotionCode(promotionCode);
  const promotion = await loadPromotion(supabase, requestedPromotionCode, now.toISOString().slice(0, 10));
  const discount = promotion
    ? applyPercentageDiscountCents(accommodationGrossCents, promotion.discount_basis_points)
    : { grossCents: accommodationGrossCents, discountCents: 0, netCents: accommodationGrossCents };
  const netNightlyCents = promotion
    ? applyDiscountToNightlyAccommodation(grossNightlyCents, promotion.discount_basis_points)
    : grossNightlyCents;

  const rulesByNight = await loadTouristTaxRulesForStay(supabase, { startDate, endDate });
  const touristTax = calculateTouristTaxStay({
    nightlyAccommodationCents: netNightlyCents,
    occupants: adults + children,
    taxablePeople: adults,
    rulesByNight,
  });
  const cleaningAppliedCents = cleaningOption ? pricing.cleaningFeeCents : 0;
  const totalCents = discount.netCents + cleaningAppliedCents + touristTax.totalTaxCents;

  return {
    nights,
    accommodationGrossCents,
    promotion: promotion ? { code: promotion.code, discountBasisPoints: promotion.discount_basis_points, discountCents: discount.discountCents } : null,
    accommodationNetCents: discount.netCents,
    cleaningFeeCents: pricing.cleaningFeeCents,
    cleaningAppliedCents,
    touristTaxCents: touristTax.totalTaxCents,
    totalCents,
    touristTaxSnapshot: {
      version: "v4.9-2026-09-27",
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
    estimated_total: centsToEuros(quote.totalCents),
  };
}
