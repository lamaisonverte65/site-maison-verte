const LEGACY_DEPOSIT_RATE = 0.30;

function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function finiteMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function hasV410FinancialSnapshot(booking = {}) {
  return present(booking.contract_total)
    && present(booking.deposit_rate)
    && present(booking.deposit_basis)
    && present(booking.deposit_amount)
    && finiteMoney(booking.contract_total) !== null
    && finiteMoney(booking.deposit_rate) !== null
    && finiteMoney(booking.deposit_basis) !== null
    && finiteMoney(booking.deposit_amount) !== null;
}

export function contractualTotal(booking = {}) {
  if (hasV410FinancialSnapshot(booking)) return Number(booking.contract_total);
  if (present(booking.owner_price)) return Number(booking.owner_price);
  return Number(booking.estimated_total ?? 0);
}

export function contractualDeposit(booking = {}) {
  if (hasV410FinancialSnapshot(booking)) return Number(booking.deposit_amount);
  const stored = present(booking.deposit_amount) ? finiteMoney(booking.deposit_amount) : null;
  if (stored !== null && stored >= 0) return stored;
  return Math.round(contractualTotal(booking) * LEGACY_DEPOSIT_RATE * 100) / 100;
}

export function recordedPaidAmount(booking = {}) {
  const stored = finiteMoney(booking.amount_paid ?? booking.total_paid);
  if (stored !== null && stored > 0) return stored;

  const normalize = (value) => String(value || "").trim().toLowerCase();
  const total = contractualTotal(booking);
  if (normalize(booking.balance_status) === "paid") return total;

  let paid = 0;
  if (normalize(booking.deposit_status) === "paid") paid += contractualDeposit(booking);
  if (normalize(booking.manual_payment_status) === "paid") {
    paid += finiteMoney(booking.manual_payment_amount) ?? 0;
  }
  return paid;
}

export function remainingContractualDue(booking = {}) {
  return Math.max(contractualTotal(booking) - recordedPaidAmount(booking), 0);
}

export const LEGACY_PAYMENT_DEFAULTS = Object.freeze({ depositRate: LEGACY_DEPOSIT_RATE });
