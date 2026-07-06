import { useMemo } from "react";
import {
  getRequestName,
  getAmounts,
  getDepositStatus,
  getBalanceStatus,
  getConfirmedStayAmount,
  getRealPaidAmount,
  getStripeFeeAmount,
  getStripeNetAmount,
} from "../utils/adminFormatters";

export function usePaymentData({
  bookingRequests,
  stripeBalanceTransactions,
}) {
  const paymentRows = useMemo(() => bookingRequests
    .filter((r) => ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed", "cancelled"].includes(r.status) || Number(r.stripe_fee_amount || 0) > 0 || Number(r.stripe_net_amount || 0) > 0)
    .map((r) => {
      const relatedTransactions = (stripeBalanceTransactions || []).filter((transaction) => transaction.booking_request_id === r.id);
      const reconciledTransactions = relatedTransactions.filter((transaction) => transaction.reconciliation_status === "viré" || transaction.payout_id);
      const payoutIds = [...new Set(reconciledTransactions.map((transaction) => transaction.payout_id).filter(Boolean))];
      const payoutDates = reconciledTransactions.map((transaction) => transaction.available_on || transaction.created_at_stripe).filter(Boolean);
      const stripeNetAmount = getStripeNetAmount(r);
      const stripeTransferStatus = reconciledTransactions.length > 0
        ? "réellement viré"
        : stripeNetAmount > 0
          ? "net théorique / en attente payout"
          : "en attente paiement";

      return {
        id: r.id,
        name: getRequestName(r),
        status: r.status,
        amounts: getAmounts(r),
        paymentStatus: r.payment_status || "non configuré",
        depositStatus: getDepositStatus(r),
        balanceStatus: getBalanceStatus(r),
        startDate: r.start_date,
        endDate: r.end_date,
        paymentLink: r.payment_link,
        expiresAt: r.acceptance_expires_at,
        confirmedAmount: getConfirmedStayAmount(r),
        paidClientAmount: getRealPaidAmount(r),
        stripeFeeAmount: getStripeFeeAmount(r),
        stripeNetAmount,
        stripeTransferStatus,
        payoutStatus: r.stripe_payout_status,
        payoutArrivalDate: r.stripe_payout_arrival_date || payoutDates[0] || null,
        payoutIds,
        relatedTransactions,
        depositPaidAt: r.deposit_paid_at,
        depositDueAt: r.deposit_due_at || r.acceptance_expires_at,
        balancePaidAt: r.balance_paid_at,
        balanceDueAt: r.balance_due_at,
        transferDate: r.transfer_date,
      };
    }), [bookingRequests, stripeBalanceTransactions]);

  return { paymentRows };
}
