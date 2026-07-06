import { useMemo } from "react";
import { getAmounts } from "../utils/adminFormatters";

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(values) {
  const dates = values.map(toDate).filter(Boolean).sort((a, b) => b - a);
  return dates[0] || null;
}

function oldestDate(values) {
  const dates = values.map(toDate).filter(Boolean).sort((a, b) => a - b);
  return dates[0] || null;
}

function isActiveReservation(reservation) {
  return ["accepted", "deposit_paid", "paid", "fully_paid", "confirmed"].includes(reservation.status);
}

function isPastReservation(reservation) {
  const end = toDate(reservation.end_date || reservation.stay?.endDate);
  return end ? end < new Date() : false;
}

export function useCustomerProfile({ customer, reservations = [] }) {
  return useMemo(() => {
    const safeReservations = Array.isArray(reservations) ? reservations : [];
    const displayName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Client sans nom";

    const totals = safeReservations.reduce((acc, reservation) => {
      const amounts = getAmounts(reservation);
      const stayTotal = Number(reservation.owner_price || reservation.estimated_total || amounts.total || 0);
      const paid = Number(amounts.paid || reservation.amount_paid || 0);
      const refunded = Number(reservation.refunded_amount || 0);
      acc.totalStay += stayTotal;
      acc.totalPaid += paid;
      acc.totalRefunded += refunded;
      if (isActiveReservation(reservation)) acc.activeReservations += 1;
      if (isPastReservation(reservation)) acc.pastReservations += 1;
      return acc;
    }, {
      totalStay: 0,
      totalPaid: 0,
      totalRefunded: 0,
      activeReservations: 0,
      pastReservations: 0,
    });

    const firstStay = customer?.first_stay || oldestDate(safeReservations.map((reservation) => reservation.start_date || reservation.stay?.startDate))?.toISOString();
    const lastStay = customer?.last_stay || latestDate(safeReservations.map((reservation) => reservation.end_date || reservation.stay?.endDate))?.toISOString();
    const bookingCount = Number(customer?.booking_count ?? safeReservations.length ?? 0);
    const communicationCount = safeReservations.reduce((count, reservation) => count
      + Number(Boolean(reservation.message))
      + Number(Boolean(reservation.owner_message))
      + Number(Boolean(reservation.manual_payment_message)), 0);

    return {
      customer,
      displayName,
      reservations: safeReservations,
      bookingCount,
      firstStay,
      lastStay,
      totalSpent: Number(customer?.total_spent ?? totals.totalPaid ?? 0),
      ownerNetTotal: Number(customer?.owner_net_total ?? 0),
      calculatedTotalStay: totals.totalStay,
      calculatedPaid: totals.totalPaid,
      totalRefunded: totals.totalRefunded,
      activeReservations: totals.activeReservations,
      pastReservations: totals.pastReservations,
      communicationCount,
      hasContact: Boolean(customer?.email || customer?.phone),
      hasAddress: Boolean(customer?.address || customer?.postal_code || customer?.city || customer?.country),
      isLoyal: bookingCount > 1,
      marketingConsent: Boolean(customer?.marketing_consent),
    };
  }, [customer, reservations]);
}
