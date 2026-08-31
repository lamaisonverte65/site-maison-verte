import { useMemo } from "react";
import {
  normalizeSource,
  uniqueVisitorCount,
  groupCount,
  getCountryLabel,
  isCancelledFinancialStatus,
  isConfirmedFinancialStatus,
  getRealPaidAmount,
  getHistoricalGrossPaidAmount,
  getStripeBankExpectedNet,
  getConfirmedStayAmount,
} from "../utils/adminFormatters";

export function useAdminStats({
  bookingRequests,
  confirmedReservations,
  customers,
  guestReviews,
  pageViewVisits,
  stripePayouts,
  stripeBalanceTransactions,
  visitsSince,
}) {
  const stats = useMemo(() => {
    const activeRequests = bookingRequests.filter((request) => !isCancelledFinancialStatus(request.status));
    const paidRequests = activeRequests.filter(
      (request) => isConfirmedFinancialStatus(request.status) && getRealPaidAmount(request) > 0,
    );
    const confirmedRequests = activeRequests.filter((request) => isConfirmedFinancialStatus(request.status));
    const requestsCount = bookingRequests.length;
    const confirmedCount = confirmedReservations.length || confirmedRequests.length;
    const uniqueVisitors30 = uniqueVisitorCount(pageViewVisits);
    const totalVisitors = pageViewVisits.length;

    const depositCollected = activeRequests.reduce((sum, request) => {
      if (!request.deposit_paid_at) return sum;
      const paid = getRealPaidAmount(request);
      const deposit = Number(request.deposit_amount || 0);
      return sum + Math.min(paid, deposit || paid);
    }, 0);
    const totalCollected = activeRequests.reduce((sum, request) => sum + getRealPaidAmount(request), 0);
    const balanceCollected = Math.max(totalCollected - depositCollected, 0);

    // Synthèse bancaire Stripe : toutes les transactions réelles comptent,
    // y compris les réservations annulées/remboursées, car elles génèrent
    // des frais et doivent expliquer le montant réellement viré par Stripe.
    const stripeGrossPaymentTotal = bookingRequests.reduce((sum, request) => {
      const cents = request.financial_ledger?.gross_paid_cents;
      return sum + (cents === null || cents === undefined
        ? getHistoricalGrossPaidAmount(request)
        : Number(cents) / 100);
    }, 0);
    const stripeRefundTotal = bookingRequests.reduce((sum, request) => {
      const cents = request.financial_ledger?.refunded_cents;
      return sum + (cents === null || cents === undefined
        ? Number(request.refunded_amount || 0)
        : Number(cents) / 100);
    }, 0);
    const completeFinancialRows = bookingRequests.filter(
      (request) => request.financial_ledger?.stripe_financials_complete === true,
    );
    const stripeFeeTotal = completeFinancialRows.reduce(
      (sum, request) => sum + Number(request.financial_ledger.stripe_fee_amount || 0),
      0,
    );
    const stripeNetTotal = completeFinancialRows.reduce(
      (sum, request) => sum + Number(request.financial_ledger.stripe_net_amount || 0),
      0,
    );
    const stripeBankExpectedNetTotal = getStripeBankExpectedNet(stripeNetTotal);
    const stripeFinancialsIncompleteCount = bookingRequests.filter(
      (request) => request.financial_ledger?.stripe_financials_complete === false,
    ).length;
    const stripePayoutTotal = (stripePayouts || []).reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
    const stripeReconciledNetTotal = (stripeBalanceTransactions || [])
      .filter((transaction) => transaction.reconciliation_status === "viré" && transaction.booking_request_id)
      .reduce((sum, transaction) => sum + Number(transaction.net || 0), 0);
    const caConfirmed = confirmedRequests.reduce((sum, request) => sum + getConfirmedStayAmount(request), 0);
    const remainingToCollect = Math.max(caConfirmed - totalCollected, 0);

    return {
      requests: requestsCount,
      pending: bookingRequests.filter((request) => (request.status || "pending") === "pending").length,
      accepted: bookingRequests.filter((request) => request.status === "accepted").length,
      paid: paidRequests.length,
      confirmed: confirmedCount,
      customers: customers.length,
      loyal: customers.filter((customer) => Number(customer.booking_count || 0) > 1).length,
      reviewsPending: guestReviews.filter((review) => review.status === "pending").length,
      visitsToday: visitsSince(1),
      visitsWeek: visitsSince(7),
      visitsMonth: visitsSince(30),
      visitsTotal: totalVisitors,
      uniqueVisitors30,
      marketingConsent: customers.filter((customer) => customer.marketing_consent).length,
      conversionVisitorsToRequests: totalVisitors ? (requestsCount / totalVisitors) * 100 : 0,
      conversionRequestsToBookings: requestsCount ? (confirmedCount / requestsCount) * 100 : 0,
      conversionVisitorsToBookings: totalVisitors ? (confirmedCount / totalVisitors) * 100 : 0,
      depositCollected,
      balanceCollected,
      totalCollected,
      stripeGrossPaymentTotal,
      stripeRefundTotal,
      stripeFeeTotal,
      stripeNetTotal,
      stripeBankExpectedNetTotal,
      stripeFinancialsIncompleteCount,
      stripePayoutTotal,
      stripeReconciledNetTotal,
      stripePayoutDifference: stripePayoutTotal - stripeBankExpectedNetTotal,
      caConfirmed,
      remainingToCollect,
    };
  }, [
    bookingRequests,
    confirmedReservations,
    customers,
    guestReviews,
    pageViewVisits,
    stripePayouts,
    stripeBalanceTransactions,
    visitsSince,
  ]);

  const sourceStats = useMemo(() => groupCount([
    ...bookingRequests
      .filter((request) => !isCancelledFinancialStatus(request.status))
      .map((request) => ({ source: normalizeSource(request.source) })),
    ...confirmedReservations.map((reservation) => ({ source: normalizeSource(reservation.source) })),
  ], (row) => row.source), [bookingRequests, confirmedReservations]);

  const visitSourceStats = useMemo(
    () => groupCount(pageViewVisits, (visit) => normalizeSource(visit.source || visit.referrer_domain || "Direct")),
    [pageViewVisits],
  );

  const visitCountryStats = useMemo(
    () => groupCount(pageViewVisits, getCountryLabel),
    [pageViewVisits],
  );

  return {
    stats,
    sourceStats,
    visitSourceStats,
    visitCountryStats,
  };
}
