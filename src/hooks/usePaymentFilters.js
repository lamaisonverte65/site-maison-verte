import { useMemo, useState } from "react";

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function getRowSearchText(row) {
  return [
    row.id,
    row.name,
    row.status,
    row.startDate,
    row.endDate,
    row.depositStatus,
    row.balanceStatus,
    row.stripeTransferStatus,
    row.paymentLink,
    ...(row.payoutIds || []),
  ].filter(Boolean).join(" ");
}

function isMissingStripeNet(row) {
  return Number(row.paidClientAmount || 0) > 0 && row.stripeFinancialsComplete !== true;
}

function isMissingPayout(row) {
  return Number(row.paidClientAmount || 0) > 0 && !(row.payoutIds || []).length;
}

function hasRemainingBalance(row) {
  return Number(row.confirmedAmount || 0) > Number(row.paidClientAmount || 0);
}

function matchesAlertFilter(row, alertFilter) {
  if (alertFilter === "all") return true;
  if (alertFilter === "missing_net") return isMissingStripeNet(row);
  if (alertFilter === "missing_payout") return isMissingPayout(row);
  if (alertFilter === "remaining_balance") return hasRemainingBalance(row);
  if (alertFilter === "paid") return Number(row.paidClientAmount || 0) > 0;
  return true;
}

function matchesStatusFilter(row, statusFilter) {
  if (statusFilter === "all") return true;
  if (statusFilter === "paid_group") return ["paid", "fully_paid", "confirmed", "deposit_paid"].includes(row.status);
  return row.status === statusFilter;
}

export function usePaymentFilters(paymentRows = []) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [alertFilter, setAlertFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalize(query);

    return (paymentRows || []).filter((row) => {
      const matchesQuery = !normalizedQuery || normalize(getRowSearchText(row)).includes(normalizedQuery);
      return matchesQuery && matchesStatusFilter(row, statusFilter) && matchesAlertFilter(row, alertFilter);
    });
  }, [paymentRows, query, statusFilter, alertFilter]);

  const stats = useMemo(() => {
    const rows = paymentRows || [];
    return {
      count: rows.length,
      filteredCount: filteredRows.length,
      confirmedTotal: rows.reduce((sum, row) => sum + Number(row.confirmedAmount || 0), 0),
      paidTotal: rows.reduce((sum, row) => sum + Number(row.paidClientAmount || 0), 0),
      stripeFeesTotal: rows.reduce((sum, row) => sum + Number(row.stripeFeeAmount || 0), 0),
      stripeNetTotal: rows.reduce((sum, row) => sum + Number(row.stripeNetAmount || 0), 0),
      remainingTotal: rows.reduce((sum, row) => sum + Math.max(Number(row.confirmedAmount || 0) - Number(row.paidClientAmount || 0), 0), 0),
      missingStripeNetCount: rows.filter(isMissingStripeNet).length,
      missingPayoutCount: rows.filter(isMissingPayout).length,
      remainingBalanceCount: rows.filter(hasRemainingBalance).length,
    };
  }, [paymentRows, filteredRows]);

  return {
    query,
    statusFilter,
    alertFilter,
    filteredRows,
    stats,
    setQuery,
    setStatusFilter,
    setAlertFilter,
  };
}
