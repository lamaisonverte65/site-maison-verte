import { normalizeTaxRule } from "./tourist-tax.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value, label) {
  const text = String(value || "");
  if (!DATE_PATTERN.test(text)) throw new Error(`${label} invalide.`);
  const date = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`${label} invalide.`);
  }
  return text;
}

export function getStayNightKeys(startDate, endDate) {
  const start = assertDate(startDate, "Date d’arrivée");
  const end = assertDate(endDate, "Date de départ");
  if (end <= start) throw new Error("Période de séjour invalide.");

  const nights = [];
  for (
    let cursor = new Date(`${start}T12:00:00Z`);
    cursor < new Date(`${end}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    nights.push(cursor.toISOString().slice(0, 10));
  }
  return nights;
}

export function resolveTouristTaxRulesByNight({ startDate, endDate, rules }) {
  const nights = getStayNightKeys(startDate, endDate);
  const activeRules = (rules || [])
    .filter((rule) => rule?.is_active !== false)
    .map((rule) => ({ raw: rule, normalized: normalizeTaxRule(rule) }));

  return nights.map((night) => {
    const matches = activeRules.filter(({ normalized }) => (
      normalized.effectiveFrom <= night
      && (!normalized.effectiveTo || normalized.effectiveTo >= night)
    ));
    if (matches.length === 0) throw new Error(`Aucune règle de taxe de séjour applicable au ${night}.`);
    if (matches.length > 1) throw new Error(`Plusieurs règles de taxe de séjour applicables au ${night}.`);
    return matches[0].raw;
  });
}

export async function loadTouristTaxRulesForStay(supabase, { startDate, endDate }) {
  const nights = getStayNightKeys(startDate, endDate);
  const firstNight = nights[0];
  const lastNight = nights[nights.length - 1];

  const { data, error } = await supabase
    .from("tourist_tax_rules")
    .select("id,effective_from,effective_to,classification,calculation_type,base_rate_basis_points,department_additional_basis_points,regional_additional_basis_points,base_cap_cents,fixed_rate_cents,is_active")
    .eq("is_active", true)
    .lte("effective_from", lastNight)
    .or(`effective_to.is.null,effective_to.gte.${firstNight}`)
    .order("effective_from", { ascending: true });

  if (error) throw error;
  return resolveTouristTaxRulesByNight({ startDate, endDate, rules: data || [] });
}
