const NON_CONTRACT_REASONS = new Set(["cleaning", "additional_charge"]);

export function getNonContractStripeFinancials({ payments = [], stripeBalanceTransactions = [] } = {}) {
  const paid = payments.filter((payment) =>
    !payment.booking_request_id
    && payment.status === "paid"
    && NON_CONTRACT_REASONS.has(payment.manual_reason),
  );
  const paymentIds = paid.map((payment) => payment.id).filter(Boolean);
  const paymentIdSet = new Set(paymentIds);
  const transactions = stripeBalanceTransactions.filter((transaction) => paymentIdSet.has(transaction.payment_id));

  return {
    gross: paid.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    fee: transactions.reduce((sum, transaction) => sum + Number(transaction.fee || 0), 0),
    net: transactions.reduce((sum, transaction) => sum + Number(transaction.net || 0), 0),
    paymentIds,
  };
}
