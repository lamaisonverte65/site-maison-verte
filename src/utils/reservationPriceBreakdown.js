// Vue de lecture uniquement : ne recalcule jamais les tarifs, la taxe ou le contrat.
// Dans le snapshot V4.10 : base acompte = hébergement net + ménage retenu.
// Les documents anciens ou incomplets ne doivent pas recevoir une ventilation inventée.
function cents(value) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function getReservationPriceBreakdown(request = {}) {
  const accommodation = cents(request.accommodation_net);
  const depositBasis = cents(request.deposit_basis);
  const touristTax = cents(request.tourist_tax_amount);
  const total = cents(request.contract_total);

  if ([accommodation, depositBasis, touristTax, total].some((value) => value === null)) {
    return null;
  }
  const cleaning = depositBasis - accommodation;
  if (accommodation < 0 || cleaning < 0 || touristTax < 0 || total < 0 || depositBasis + touristTax !== total) {
    return null;
  }
  return {
    accommodation: accommodation / 100,
    cleaning: cleaning / 100,
    touristTax: touristTax / 100,
    total: total / 100,
  };
}
