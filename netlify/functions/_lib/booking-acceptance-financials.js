function toCents(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} invalide.`);
  return Math.round(number * 100);
}

function fromCents(value) {
  return Math.round(Number(value)) / 100;
}

export function buildV410AcceptanceFinancials(booking, specialAccommodation = null) {
  const grossCents = toCents(booking.accommodation_gross, "Tarif normal d’hébergement");
  const currentNetCents = toCents(booking.accommodation_net, "Tarif d’hébergement appliqué");
  const taxCents = toCents(booking.tourist_tax_amount, "Taxe de séjour");
  const cleaningFeeCents = toCents(booking.cleaning_fee || 0, "Forfait ménage");
  const depositRate = Number(booking.deposit_rate);
  if (!Number.isFinite(depositRate) || depositRate < 0 || depositRate > 1) {
    throw new Error("Taux d’acompte invalide.");
  }
  if (!booking.tourist_tax_snapshot || typeof booking.tourist_tax_snapshot !== "object") {
    throw new Error("Snapshot de taxe de séjour manquant.");
  }

  const hasSpecial = specialAccommodation !== null
    && specialAccommodation !== undefined
    && String(specialAccommodation).trim() !== "";

  let appliedCents = currentNetCents;
  let promotionCode = booking.promotion_code || null;
  let promotionDiscountRate = booking.promotion_discount_rate ?? null;
  let promotionDiscountAmount = booking.promotion_discount_amount ?? null;

  if (hasSpecial) {
    appliedCents = toCents(specialAccommodation, "Tarif spécial d’hébergement");
    if (appliedCents <= 0) throw new Error("Tarif spécial d’hébergement invalide.");
    if (appliedCents > currentNetCents) {
      throw new Error("Le tarif spécial ne peut pas être supérieur au tarif d’hébergement actuellement appliqué.");
    }
    const actualDiscountCents = Math.max(grossCents - appliedCents, 0);
    promotionCode = null;
    promotionDiscountAmount = fromCents(actualDiscountCents);
    promotionDiscountRate = grossCents > 0 ? actualDiscountCents / grossCents : null;
  }

  const cleaningAppliedCents = booking.cleaning_option === true ? cleaningFeeCents : 0;
  const depositBasisCents = appliedCents + cleaningAppliedCents;
  const depositAmountCents = Math.round(depositBasisCents * depositRate);
  const contractTotalCents = depositBasisCents + taxCents;

  return {
    accommodation_gross: fromCents(grossCents),
    accommodation_net: fromCents(appliedCents),
    promotion_code: promotionCode,
    promotion_discount_rate: promotionDiscountRate,
    promotion_discount_amount: promotionDiscountAmount,
    tourist_tax_amount: fromCents(taxCents),
    tourist_tax_collector: booking.tourist_tax_collector || "la_maison_verte",
    tourist_tax_snapshot: booking.tourist_tax_snapshot,
    deposit_rate: depositRate,
    deposit_basis: fromCents(depositBasisCents),
    deposit_amount: fromCents(depositAmountCents),
    contract_total: fromCents(contractTotalCents),
  };
}
