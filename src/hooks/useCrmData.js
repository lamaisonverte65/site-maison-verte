import { useMemo } from "react";

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from, to = new Date()) {
  if (!from) return null;
  const start = normalizeDate(from);
  if (!start) return null;
  const diff = to.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getCustomerName(customer) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Client sans nom";
}

function getLastStay(customer, reservations = []) {
  if (customer.last_stay) return customer.last_stay;
  const dated = reservations
    .map((reservation) => reservation.end_date || reservation.start_date)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  return dated[0] || null;
}

function getNextStay(reservations = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return reservations
    .filter((reservation) => reservation.start_date && new Date(reservation.start_date) >= today)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] || null;
}

export function useCrmData({ customers = [], bookingRequests = [], customerReservations = new Map() }) {
  return useMemo(() => {
    const enrichedCustomers = customers.map((customer) => {
      const reservations = customerReservations.get(customer.id) || [];
      const bookingCount = Number(customer.booking_count ?? reservations.length ?? 0);
      const totalSpent = Number(customer.total_spent || 0);
      const ownerNetTotal = Number(customer.owner_net_total || 0);
      const lastStay = getLastStay(customer, reservations);
      const nextStay = getNextStay(reservations);
      const daysSinceLastStay = daysBetween(lastStay);

      return {
        ...customer,
        displayName: getCustomerName(customer),
        reservations,
        bookingCount,
        totalSpent,
        ownerNetTotal,
        lastStay,
        nextStay,
        daysSinceLastStay,
        hasEmail: Boolean(customer.email),
        hasPhone: Boolean(customer.phone),
        isLoyal: bookingCount > 1,
        isHighValue: totalSpent > 1000,
        canBeContacted: Boolean(customer.email || customer.phone),
      };
    });

    const loyalCustomers = enrichedCustomers
      .filter((customer) => customer.isLoyal)
      .sort((a, b) => b.bookingCount - a.bookingCount || b.totalSpent - a.totalSpent);

    const highValueCustomers = enrichedCustomers
      .filter((customer) => customer.isHighValue)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const marketingOptIn = enrichedCustomers.filter((customer) => customer.marketing_consent);
    const marketingNoConsent = enrichedCustomers.filter((customer) => !customer.marketing_consent);

    const followUpCustomers = enrichedCustomers
      .filter((customer) => {
        if (!customer.canBeContacted) return false;
        if (customer.nextStay) return false;
        if (customer.daysSinceLastStay === null) return false;
        return customer.daysSinceLastStay >= 180 && customer.daysSinceLastStay <= 900;
      })
      .sort((a, b) => (b.lastStay || "").localeCompare(a.lastStay || ""));

    const customersWithoutContact = enrichedCustomers.filter((customer) => !customer.email && !customer.phone);
    const customersWithUpcomingStay = enrichedCustomers
      .filter((customer) => customer.nextStay)
      .sort((a, b) => new Date(a.nextStay.start_date) - new Date(b.nextStay.start_date));

    const stats = {
      totalCustomers: enrichedCustomers.length,
      loyalCustomers: loyalCustomers.length,
      highValueCustomers: highValueCustomers.length,
      marketingOptIn: marketingOptIn.length,
      marketingNoConsent: marketingNoConsent.length,
      followUpCustomers: followUpCustomers.length,
      customersWithoutContact: customersWithoutContact.length,
      customersWithUpcomingStay: customersWithUpcomingStay.length,
      totalReservations: bookingRequests.length,
    };

    return {
      customers: enrichedCustomers,
      loyalCustomers,
      highValueCustomers,
      marketingOptIn,
      marketingNoConsent,
      followUpCustomers,
      customersWithoutContact,
      customersWithUpcomingStay,
      stats,
    };
  }, [customers, bookingRequests, customerReservations]);
}
