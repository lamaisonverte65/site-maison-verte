import {
  getBalanceStatus,
  getConfirmedStayAmount,
  getDepositStatus,
  getRealPaidAmount,
} from "./adminFormatters";

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export function toPaymentView(request = {}, amounts = {}) {
  const total = toNumber(amounts.total);
  const paid = toNumber(amounts.paid);
  const deposit = toNumber(amounts.deposit);
  const balance = toNumber(amounts.balance);

  return {
    total,
    paid,
    remaining: Math.max(total - paid, 0),
    confirmedRevenue: getConfirmedStayAmount(request),
    realPaid: getRealPaidAmount(request),
    deposit: {
      status: getDepositStatus(request),
      amount: deposit,
      paidAt: request.deposit_paid_at || null,
      dueAt: request.deposit_due_at || request.acceptance_expires_at || null,
      linkExpiresAt: request.acceptance_expires_at || null,
    },
    balance: {
      status: getBalanceStatus(request),
      amount: balance,
      paidAt: request.balance_paid_at || null,
      dueAt: request.balance_due_at || null,
    },
    manualPayment: request.manual_payment_status
      ? {
          status: request.manual_payment_status,
          amount: toNumber(request.manual_payment_amount),
        }
      : null,
  };
}
