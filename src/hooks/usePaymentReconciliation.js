import { useMemo } from "react";

export function usePaymentReconciliation({ stripePayouts = [], stripeBalanceTransactions = [] } = {}) {
  return useMemo(() => {
    const payoutCount = stripePayouts.length;
    const payoutTotal = stripePayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
    const expectedNetTotal = stripePayouts.reduce((sum, payout) => sum + Number(payout.expected_net_total || 0), 0);
    const payoutDifferenceTotal = stripePayouts.reduce((sum, payout) => sum + Number(payout.difference_amount || 0), 0);

    const transactionTotal = stripeBalanceTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const feeTotal = stripeBalanceTransactions.reduce((sum, transaction) => sum + Number(transaction.fee || 0), 0);
    const netTotal = stripeBalanceTransactions.reduce((sum, transaction) => sum + Number(transaction.net || 0), 0);

    const unreconciledTransactions = stripeBalanceTransactions.filter((transaction) => !transaction.payout_id || transaction.reconciliation_status === "unmatched");
    const payoutsWithDifference = stripePayouts.filter((payout) => Math.abs(Number(payout.difference_amount || 0)) > 0.01);

    return {
      payoutCount,
      transactionCount: stripeBalanceTransactions.length,
      payoutTotal,
      expectedNetTotal,
      payoutDifferenceTotal,
      transactionTotal,
      feeTotal,
      netTotal,
      unreconciledTransactions,
      payoutsWithDifference,
      hasAlerts: unreconciledTransactions.length > 0 || payoutsWithDifference.length > 0,
    };
  }, [stripePayouts, stripeBalanceTransactions]);
}
