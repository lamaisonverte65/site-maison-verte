import { useMemo, useState } from "react";

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function getRowSearchText(row) {
  return [
    row.id, row.name, row.sourceLabel, row.externalReference, row.paymentReference,
    row.status, row.startDate, row.endDate, row.paymentState,
    row.depositStatus, row.balanceStatus, row.stripeTransferStatus,
    ...(row.payoutIds || []),
  ].filter(Boolean).join(" ");
}

const isSite = (row) => row.source === "site";
function isMissingStripeNet(row) {
  return isSite(row) && row.adminPaymentMethod !== "cash" && Number(row.paidClientAmount || 0) > 0 && row.hasStripeReference && row.stripeFinancialsComplete !== true;
}
function isMissingPayout(row) {
  return isSite(row) && row.adminPaymentMethod !== "cash" && Number(row.paidClientAmount || 0) > 0 && row.hasStripeReference && !(row.payoutIds || []).length;
}
function hasRemainingBalance(row) {
  return isSite(row) && Number(row.confirmedAmount || 0) > Number(row.paidClientAmount || 0);
}
function matchesAlertFilter(row, alertFilter) {
  if (alertFilter === "all") return true;
  if (alertFilter === "missing_net") return isMissingStripeNet(row);
  if (alertFilter === "missing_payout") return isMissingPayout(row);
  if (alertFilter === "payment_reference_missing") return isSite(row) && row.adminPaymentMethod !== "cash" && Number(row.paidClientAmount || 0) > 0 && !row.hasStripeReference && !row.stripeFinancialsComplete;
  if (alertFilter === "remaining_balance") return hasRemainingBalance(row);
  if (alertFilter === "paid") return isSite(row) ? Number(row.paidClientAmount || 0) > 0 : row.platformNetAmount !== null;
  if (alertFilter === "platform_missing") return !isSite(row) && ["booking", "airbnb"].includes(row.source) && row.platformNetAmount == null;
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
  const [sourceFilter, setSourceFilter] = useState("all");

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalize(query);
    return (paymentRows || []).filter((row) =>
      (sourceFilter === "all" || row.source === sourceFilter) &&
      (!normalizedQuery || normalize(getRowSearchText(row)).includes(normalizedQuery)) &&
      matchesStatusFilter(row, statusFilter) && matchesAlertFilter(row, alertFilter));
  }, [paymentRows, query, statusFilter, alertFilter, sourceFilter]);

  const stats = useMemo(() => {
    const site = (paymentRows || []).filter(isSite);
    const platform = (paymentRows || []).filter((row) => ["booking", "airbnb"].includes(row.source));
    return {
      count: paymentRows.length,
      filteredCount: filteredRows.length,
      confirmedTotal: site.reduce((sum, row) => sum + Number(row.confirmedAmount || 0), 0),
      paidTotal: site.reduce((sum, row) => sum + Number(row.paidClientAmount || 0), 0),
      stripeFeesTotal: site.reduce((sum, row) => sum + Number(row.stripeFeeAmount || 0), 0),
      stripeNetTotal: site.reduce((sum, row) => sum + Number(row.stripeNetAmount || 0), 0),
      remainingTotal: site.reduce((sum, row) => sum + Math.max(Number(row.confirmedAmount || 0) - Number(row.paidClientAmount || 0), 0), 0),
      missingStripeNetCount: site.filter(isMissingStripeNet).length,
      paymentReferenceMissingCount: site.filter((row) => row.adminPaymentMethod !== "cash" && Number(row.paidClientAmount || 0) > 0 && !row.hasStripeReference && !row.stripeFinancialsComplete).length,
      missingPayoutCount: site.filter(isMissingPayout).length,
      remainingBalanceCount: site.filter(hasRemainingBalance).length,
      platformMissingCount: platform.filter((row) => row.platformNetAmount == null).length,
      platformCount: platform.length,
      platformNetKnown: platform.filter((row) => row.platformNetAmount != null).reduce((sum, row) => sum + Number(row.platformNetAmount), 0),
    };
  }, [paymentRows, filteredRows]);

  function showAlert(type) {
    setAlertFilter(type);
    setStatusFilter("all");
    setQuery("");
    setSourceFilter(type === "platform_missing" ? "all" : "site");
  }
  return {
    query, statusFilter, alertFilter, sourceFilter, filteredRows, stats,
    setQuery, setStatusFilter, setAlertFilter, setSourceFilter, showAlert,
  };
}
