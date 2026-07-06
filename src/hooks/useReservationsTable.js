import { useMemo, useState } from "react";
import {
  getAmounts,
  getBalanceStatus,
  getDepositStatus,
  getRequestName,
  normalizeSource,
} from "../utils/adminFormatters";

const PAID_GROUP_STATUSES = ["deposit_paid", "paid", "fully_paid", "confirmed"];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function toTimestamp(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getReservationText(reservation) {
  return [
    reservation.id,
    getRequestName(reservation),
    reservation.guest_first_name,
    reservation.guest_last_name,
    reservation.guest_email,
    reservation.guest_phone,
    reservation.start_date,
    reservation.end_date,
    reservation.status,
    reservation.source,
    reservation.message,
    reservation.owner_message,
    reservation.payment_status,
    reservation.deposit_status,
    reservation.balance_status,
    reservation.children_ages,
  ].filter(Boolean).join(" ").toLowerCase();
}

function getFirstName(reservation = {}) {
  return reservation.guest_first_name || reservation.first_name || "";
}

function getLastName(reservation = {}) {
  return (
    reservation.guest_last_name ||
    reservation.last_name ||
    reservation.display_name ||
    reservation.title ||
    ""
  );
}

function getSortValue(reservation, key) {
  const amounts = getAmounts(reservation);

  switch (key) {
    case "id":
      return reservation.id || "";
    case "guest_first_name":
      return getFirstName(reservation);
    case "guest_last_name":
      return getLastName(reservation);
    case "created_at":
      return toTimestamp(reservation.created_at);
    case "start_date":
      return toTimestamp(reservation.start_date);
    case "end_date":
      return toTimestamp(reservation.end_date);
    case "status":
      return reservation.status || "pending";
    case "source":
      return normalizeSource(reservation.source || "Direct");
    case "deposit":
      return Number(amounts.deposit || 0);
    case "balance":
      return Number(amounts.balance || 0);
    case "paid":
      return Number(amounts.paid || 0);
    case "total":
      return Number(amounts.total || 0);
    default:
      return reservation[key] ?? "";
  }
}

function compareReservations(a, b, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  const aValue = getSortValue(a, sort.key);
  const bValue = getSortValue(b, sort.key);

  if (typeof aValue === "number" || typeof bValue === "number") {
    return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
  }

  return String(aValue).localeCompare(String(bValue), "fr", {
    numeric: true,
    sensitivity: "base",
  }) * direction;
}

function matchesAdvancedFilters(reservation, filters) {
  const status = reservation.status || "pending";
  const source = normalizeSource(reservation.source || "Direct").toLowerCase();
  const amounts = getAmounts(reservation);
  const paid = Number(amounts.paid || 0);
  const total = Number(amounts.total || 0);
  const startDate = reservation.start_date || "";

  if (filters.status !== "all") {
    if (filters.status === "paid_group") {
      if (!PAID_GROUP_STATUSES.includes(status)) return false;
    } else if (status !== filters.status) {
      return false;
    }
  }

  if (filters.source !== "all" && source !== filters.source) return false;
  if (filters.dateFrom && startDate && startDate < filters.dateFrom) return false;
  if (filters.dateTo && startDate && startDate > filters.dateTo) return false;

  if (filters.payment === "paid" && paid <= 0) return false;
  if (filters.payment === "unpaid" && paid > 0) return false;
  if (filters.payment === "partial" && !(paid > 0 && paid < total)) return false;
  if (filters.payment === "complete" && !(total > 0 && paid >= total)) return false;

  return true;
}

export function useReservationsTable(reservations = []) {
  const [tableSearch, setTableSearch] = useState("");
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({
    status: "all",
    source: "all",
    payment: "all",
    dateFrom: "",
    dateTo: "",
  });

  const visibleReservations = useMemo(() => {
    const query = normalize(tableSearch);

    return reservations
      .filter((reservation) => !query || getReservationText(reservation).includes(query))
      .filter((reservation) => matchesAdvancedFilters(reservation, filters))
      .sort((a, b) => compareReservations(a, b, sort));
  }, [reservations, tableSearch, filters, sort]);

  const selectedReservations = useMemo(
    () => visibleReservations.filter((reservation) => selectedIds.includes(reservation.id)),
    [visibleReservations, selectedIds]
  );

  function updateSort(key) {
    setSort((previous) => previous.key === key
      ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setSelectedIds([]);
  }

  function resetFilters() {
    setTableSearch("");
    setFilters({ status: "all", source: "all", payment: "all", dateFrom: "", dateTo: "" });
    setSelectedIds([]);
  }

  function toggleReservation(id) {
    setSelectedIds((previous) => previous.includes(id)
      ? previous.filter((currentId) => currentId !== id)
      : [...previous, id]);
  }

  function toggleAllVisible() {
    const visibleIds = visibleReservations.map((reservation) => reservation.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allVisibleSelected ? [] : visibleIds);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  return {
    tableSearch,
    setTableSearch,
    filters,
    updateFilter,
    resetFilters,
    sort,
    updateSort,
    visibleReservations,
    selectedIds,
    selectedReservations,
    toggleReservation,
    toggleAllVisible,
    clearSelection,
    helpers: {
      getDepositStatus,
      getBalanceStatus,
    },
  };
}
