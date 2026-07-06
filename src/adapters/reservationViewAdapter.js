import {
  getAmounts,
  getConfirmedStayAmount,
  getRequestName,
  normalizeSource,
} from "../utils/adminFormatters";

export function getReservationCustomerSummary(request = {}) {
  const existing = request.customerSummary || {};
  const firstName = existing.firstName ?? request.guest_first_name ?? "";
  const lastName = existing.lastName ?? request.guest_last_name ?? "";
  const email = existing.email ?? request.guest_email ?? "";
  const phone = existing.phone ?? request.guest_phone ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || getRequestName(request);

  return {
    id: existing.id ?? request.customer_id ?? request.customer?.id ?? null,
    firstName,
    lastName,
    fullName,
    email,
    phone,
    role: existing.role ?? "Réservataire principal",
    hasContact: Boolean(email || phone),
  };
}

export function toReservationView(request = {}) {
  if (!request) return null;

  const amounts = getAmounts(request);
  const customerSummary = getReservationCustomerSummary(request);

  return {
    ...request,
    sourceRecord: request.sourceRecord || request,
    displayName: request.displayName || getRequestName(request),
    sourceLabel: request.sourceLabel || normalizeSource(request.source || "site"),
    customerSummary,
    stay: {
      startDate: request.stay?.startDate ?? request.start_date,
      endDate: request.stay?.endDate ?? request.end_date,
      nights: request.stay?.nights ?? request.nights,
      arrivalTime: request.stay?.arrivalTime ?? request.arrival_time,
    },
    occupancy: {
      adults: request.occupancy?.adults ?? request.adults_count,
      children: request.occupancy?.children ?? request.children_count,
      childrenAges: request.occupancy?.childrenAges ?? request.children_ages,
      babyBedNeeded: request.occupancy?.babyBedNeeded ?? request.baby_bed_needed,
    },
    financial: {
      amounts,
      confirmedAmount: getConfirmedStayAmount(request),
      manualPaymentAmount: Number(request.manual_payment_amount || 0),
      refundedAmount: Number(request.refunded_amount || 0),
    },
  };
}

export function toReservationViews(requests = []) {
  return requests.map((request) => toReservationView(request)).filter(Boolean);
}

export function reservationSearchText(request = {}) {
  const reservation = toReservationView(request);
  const customer = reservation.customerSummary || {};

  return [
    reservation.id,
    reservation.displayName,
    customer.firstName,
    customer.lastName,
    customer.fullName,
    customer.email,
    customer.phone,
    reservation.guest_first_name,
    reservation.guest_last_name,
    reservation.guest_email,
    reservation.guest_phone,
    reservation.start_date,
    reservation.end_date,
    reservation.message,
    reservation.owner_message,
    reservation.payment_status,
    reservation.deposit_status,
    reservation.balance_status,
    reservation.adults_count,
    reservation.children_count,
    reservation.children_ages,
    reservation.baby_bed_needed ? "bébé lit bébé" : "",
    reservation.sourceLabel,
  ].filter(Boolean).join(" ").toLowerCase();
}
