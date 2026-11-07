import { useMemo } from "react";
import { stripeReconciliationState } from "../utils/paymentEvidence";
import { mergePlatformPaymentRows, paymentSource } from "../utils/paymentPlatformAdapter";
import {
  getRequestName,
  getAmounts,
  getDepositStatus,
  getBalanceStatus,
  getConfirmedStayAmount,
  getRealPaidAmount,
} from "../utils/adminFormatters";

export function usePaymentData({
  bookingRequests,
  stripeBalanceTransactions,
  payments = [],
  externalFinancials = [],
}) {
  const paymentRows = useMemo(() => mergePlatformPaymentRows(bookingRequests
    .filter((r) => ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed", "cancelled"].includes(r.status) || Number(r.stripe_fee_amount || 0) > 0 || Number(r.stripe_net_amount || 0) > 0)
    .map((r) => {
      const financialLedger = r.financial_ledger;
      const stripeFinancialsComplete = financialLedger?.stripe_financials_complete === true;
      const evidence = stripeReconciliationState(r, payments, stripeBalanceTransactions || [], stripeFinancialsComplete);
      const relatedTransactions = evidence.linked;
      const payoutIds = evidence.payoutIds;
      const payoutDates = relatedTransactions.filter((t) => t.payout_id).map((t) => t.available_on || t.created_at_stripe).filter(Boolean);
      const stripeNetAmount = stripeFinancialsComplete ? Number(financialLedger.stripe_net_amount || 0) : null;
      const stripeFeeAmount = stripeFinancialsComplete ? Number(financialLedger.stripe_fee_amount || 0) : null;
      const stripeTransferStatus = evidence.transferStatus;

      return {
        id: r.id,
        bookingRequestId: r.id,
        customerId: r.customer_id || null,
        requesterEmail: r.guest_email || null,
        requesterPhone: r.guest_phone || null,
        createdAt: r.created_at || null,
        stripeEvidenceStatus: evidence.stripeStatus,
        hasStripeReference: evidence.hasStripeReference,
        linkedChargeCount: evidence.charges.length,
        stripePaymentIntentId: r.stripe_payment_intent_id || payments.find((p) => p.booking_request_id === r.id && p.stripe_payment_intent_id)?.stripe_payment_intent_id || null,
        stripeCheckoutSessionId: r.stripe_checkout_session_id || null,
        source: paymentSource(r.source),
        sourceLabel: paymentSource(r.source) === "site" ? "Site" : (r.source || "Autre"),
        name: getRequestName(r),
        status: r.status,
        amounts: getAmounts(r),
        paymentStatus: r.payment_status || "non configuré",
        adminPaymentMethod: r.admin_payment_method || "stripe",
        depositStatus: getDepositStatus(r),
        balanceStatus: getBalanceStatus(r),
        startDate: r.start_date,
        endDate: r.end_date,
        paymentLink: r.payment_link,
        expiresAt: r.acceptance_expires_at,
        confirmedAmount: getConfirmedStayAmount(r),
        paidClientAmount: getRealPaidAmount(r),
        stripeFeeAmount,
        stripeNetAmount,
        stripeFinancialsComplete,
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
    }), externalFinancials, bookingRequests), [bookingRequests, stripeBalanceTransactions, payments, externalFinancials]);

  return { paymentRows };
}
