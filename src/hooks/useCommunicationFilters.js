import { useMemo, useState } from "react";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function itemText(item) {
  const reservation = item.reservation || {};
  const customer = item.customer || {};
  const raw = item.raw || {};

  return [
    item.title,
    item.description,
    item.type,
    raw.email_type,
    raw.subject,
    raw.to_email,
    raw.status,
    raw.event_type,
    raw.label,
    raw.message,
    reservation.guest_first_name,
    reservation.guest_last_name,
    reservation.guest_email,
    reservation.guest_phone,
    customer.first_name,
    customer.last_name,
    customer.email,
    customer.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getItemStatus(item) {
  if (item.type === "email") return item.raw?.status || "unknown";
  if (item.type === "event") return "logged";
  if (item.type === "message") return "received";
  return "unknown";
}

function isAfterStart(item, startDate) {
  if (!startDate) return true;
  if (!item.date) return false;
  return new Date(item.date) >= new Date(`${startDate}T00:00:00`);
}

function isBeforeEnd(item, endDate) {
  if (!endDate) return true;
  if (!item.date) return false;
  return new Date(item.date) <= new Date(`${endDate}T23:59:59`);
}

export function useCommunicationFilters(items = []) {
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all",
    startDate: "",
    endDate: "",
  });

  const filteredItems = useMemo(() => {
    const search = normalize(filters.search);

    return (items || []).filter((item) => {
      if (filters.type !== "all" && item.type !== filters.type) return false;
      if (filters.status !== "all" && getItemStatus(item) !== filters.status) return false;
      if (!isAfterStart(item, filters.startDate)) return false;
      if (!isBeforeEnd(item, filters.endDate)) return false;
      if (search && !itemText(item).includes(search)) return false;
      return true;
    });
  }, [items, filters]);

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: "", type: "all", status: "all", startDate: "", endDate: "" });
  }

  return {
    filters,
    filteredItems,
    updateFilter,
    resetFilters,
  };
}
