const CENTS_PER_EURO = 100;
const BASIS_POINTS = 10000;

function integer(value, label, { min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw new Error(`${label} invalide.`);
  return number;
}

function roundDiv(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error("Calcul monétaire hors limites.");
  }
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export function eurosToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Montant invalide.");
  return Math.round(number * CENTS_PER_EURO);
}

export function centsToEuros(cents) {
  return integer(cents, "Montant") / CENTS_PER_EURO;
}

export function applyPercentageDiscountCents(amountCents, discountBasisPoints) {
  const amount = integer(amountCents, "Montant hébergement");
  const rate = integer(discountBasisPoints, "Taux de remise");
  if (rate > BASIS_POINTS) throw new Error("Taux de remise invalide.");
  const discountCents = roundDiv(amount * rate, BASIS_POINTS);
  return { grossCents: amount, discountCents, netCents: amount - discountCents };
}

export function applyDiscountToNightlyAccommodation(nightlyGrossCents, discountBasisPoints) {
  if (!Array.isArray(nightlyGrossCents) || nightlyGrossCents.length === 0) throw new Error("Nuitées hébergement manquantes.");
  const gross = nightlyGrossCents.map((value) => integer(value, "Prix de nuitée"));
  const total = applyPercentageDiscountCents(gross.reduce((sum, value) => sum + value, 0), discountBasisPoints);
  if (total.grossCents === 0) return gross.map(() => 0);

  const provisional = gross.map((value) => Math.floor(value * total.netCents / total.grossCents));
  let remainder = total.netCents - provisional.reduce((sum, value) => sum + value, 0);
  const ranked = gross.map((value, index) => ({ index, fraction: (value * total.netCents) % total.grossCents }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i += 1) provisional[ranked[i].index] += 1;
  return provisional;
}

export function normalizeTaxRule(rule) {
  if (!rule || typeof rule !== "object") throw new Error("Règle de taxe manquante.");
  const calculationType = String(rule.calculation_type || rule.calculationType || "");
  const classification = String(rule.classification || "");
  if (!new Set(["proportional", "fixed"]).has(calculationType)) throw new Error("Type de calcul de taxe invalide.");

  const normalized = {
    id: rule.id ?? null,
    classification,
    calculationType,
    effectiveFrom: String(rule.effective_from || rule.effectiveFrom || ""),
    effectiveTo: rule.effective_to || rule.effectiveTo || null,
  };

  if (calculationType === "proportional") {
    normalized.baseRateBasisPoints = integer(rule.base_rate_basis_points ?? rule.baseRateBasisPoints, "Taux de taxe");
    normalized.departmentAdditionalBasisPoints = integer(rule.department_additional_basis_points ?? rule.departmentAdditionalBasisPoints ?? 0, "Taxe départementale");
    normalized.regionalAdditionalBasisPoints = integer(rule.regional_additional_basis_points ?? rule.regionalAdditionalBasisPoints ?? 0, "Taxe régionale");
    normalized.baseCapCents = integer(rule.base_cap_cents ?? rule.baseCapCents, "Plafond");
  } else {
    normalized.fixedRateCents = integer(rule.fixed_rate_cents ?? rule.fixedRateCents, "Tarif fixe");
  }
  return normalized;
}

export function calculateTouristTaxNight({ accommodationCents, occupants, taxablePeople, rule }) {
  const accommodation = integer(accommodationCents, "Prix de nuitée");
  const totalOccupants = integer(occupants, "Nombre d'occupants", { min: 1 });
  const taxable = integer(taxablePeople, "Nombre de personnes taxables");
  if (taxable > totalOccupants) throw new Error("Nombre de personnes taxables incohérent.");
  const r = normalizeTaxRule(rule);

  if (r.calculationType === "fixed") {
    return {
      rule: r,
      accommodationCents: accommodation,
      occupants: totalOccupants,
      taxablePeople: taxable,
      baseTaxCents: r.fixedRateCents,
      cappedBaseTaxCents: r.fixedRateCents,
      departmentTaxCents: 0,
      regionalTaxCents: 0,
      personNightRateCents: r.fixedRateCents,
      totalTaxCents: r.fixedRateCents * taxable,
    };
  }

  // Aure-Louron 2026: base = prix HT de la nuitée / occupants × taux,
  // arrondi au centime, plafonné sur la part de base, puis taxes additionnelles
  // calculées et arrondies séparément sur cette base plafonnée.
  const baseTaxCents = roundDiv(accommodation * r.baseRateBasisPoints, totalOccupants * BASIS_POINTS);
  const cappedBaseTaxCents = Math.min(baseTaxCents, r.baseCapCents);
  const departmentTaxCents = roundDiv(cappedBaseTaxCents * r.departmentAdditionalBasisPoints, BASIS_POINTS);
  const regionalTaxCents = roundDiv(cappedBaseTaxCents * r.regionalAdditionalBasisPoints, BASIS_POINTS);
  const personNightRateCents = cappedBaseTaxCents + departmentTaxCents + regionalTaxCents;

  return {
    rule: r,
    accommodationCents: accommodation,
    occupants: totalOccupants,
    taxablePeople: taxable,
    baseTaxCents,
    cappedBaseTaxCents,
    departmentTaxCents,
    regionalTaxCents,
    personNightRateCents,
    totalTaxCents: personNightRateCents * taxable,
  };
}

export function calculateTouristTaxStay({ nightlyAccommodationCents, occupants, taxablePeople, rulesByNight }) {
  if (!Array.isArray(nightlyAccommodationCents) || nightlyAccommodationCents.length === 0) throw new Error("Nuitées hébergement manquantes.");
  if (!Array.isArray(rulesByNight) || rulesByNight.length !== nightlyAccommodationCents.length) throw new Error("Règles de taxe incohérentes avec les nuitées.");

  const nights = nightlyAccommodationCents.map((accommodationCents, index) => calculateTouristTaxNight({
    accommodationCents,
    occupants,
    taxablePeople,
    rule: rulesByNight[index],
  }));

  return {
    nights,
    nightsCount: nights.length,
    occupants: Number(occupants),
    taxablePeople: Number(taxablePeople),
    exemptPeople: Number(occupants) - Number(taxablePeople),
    accommodationCents: nightlyAccommodationCents.reduce((sum, value) => sum + integer(value, "Prix de nuitée"), 0),
    totalTaxCents: nights.reduce((sum, night) => sum + night.totalTaxCents, 0),
  };
}
