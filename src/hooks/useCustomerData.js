import { useMemo } from "react";
import { normalizeSource } from "../utils/adminFormatters";
import { buildCustomerReservationMap } from "../adapters/customerReservationAdapter";

export function useCustomerData({
  customers,
  bookingRequests,
  search,
  customerSort,
  customerFilter,
}) {
  const normalizedSearch = search.trim().toLowerCase();

  const customerReservations = useMemo(
    () => buildCustomerReservationMap(customers, bookingRequests),
    [customers, bookingRequests]
  );

  const filteredCustomers = useMemo(() => {
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    const filtered = customers.filter((customer) => {
      const bookingCount = Number(customer.booking_count || 0);
      const totalSpent = Number(customer.total_spent || 0);
      const lastStay = customer.last_stay ? new Date(customer.last_stay) : null;
      const source = normalizeSource(customer.source).toLowerCase();

      if (customerFilter === "loyal" && bookingCount <= 1) return false;
      if (customerFilter === "multi_stay" && bookingCount <= 2) return false;
      if (customerFilter === "high_value" && totalSpent <= 1000) return false;
      if (customerFilter === "recent" && (!lastStay || lastStay < twoYearsAgo)) return false;
      if (customerFilter === "optin_yes" && !customer.marketing_consent) return false;
      if (customerFilter === "optin_no" && customer.marketing_consent) return false;
      if (customerFilter.startsWith("source_") && source !== customerFilter.replace("source_", "")) return false;

      const text = [customer.first_name, customer.last_name, customer.email, customer.phone, customer.source, customer.notes, customer.booking_count, customer.total_spent, customer.owner_net_total, customer.created_at, customer.first_stay, customer.last_stay].filter(Boolean).join(" ").toLowerCase();
      return text.includes(normalizedSearch);
    });

    return filtered.sort((a, b) => {
      const direction = customerSort.direction === "asc" ? 1 : -1;
      const aValue = a[customerSort.key] ?? "";
      const bValue = b[customerSort.key] ?? "";
      if (["booking_count", "total_spent", "owner_net_total", "loyalty_discount_percent"].includes(customerSort.key)) return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
      if (["first_stay", "last_stay", "created_at"].includes(customerSort.key)) return (new Date(aValue || 0) - new Date(bValue || 0)) * direction;
      return String(aValue).localeCompare(String(bValue), "fr", { numeric: true, sensitivity: "base" }) * direction;
    });
  }, [customers, normalizedSearch, customerSort, customerFilter]);

  return { customerReservations, filteredCustomers };
}
