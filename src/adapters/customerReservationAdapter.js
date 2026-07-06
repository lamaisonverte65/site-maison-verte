import { toReservationView } from "./reservationViewAdapter";

function cleanPhone(value) {
  return String(value || "").replace(/\s/g, "");
}

function cleanText(value) {
  return String(value || "").trim().toLowerCase();
}

export function isCustomerLinkedToReservation(customer = {}, reservation = {}) {
  const sameEmail = customer.email && reservation.guest_email
    && cleanText(customer.email) === cleanText(reservation.guest_email);
  const samePhone = customer.phone && reservation.guest_phone
    && cleanPhone(customer.phone) === cleanPhone(reservation.guest_phone);
  const sameName = customer.first_name && customer.last_name && reservation.guest_first_name && reservation.guest_last_name
    && cleanText(customer.first_name) === cleanText(reservation.guest_first_name)
    && cleanText(customer.last_name) === cleanText(reservation.guest_last_name);

  return Boolean(sameEmail || samePhone || sameName);
}

export function findCustomerForReservation(customers = [], reservation = {}) {
  return customers.find((customer) => isCustomerLinkedToReservation(customer, reservation)) || null;
}

export function toCustomerReservationView(customer = {}, reservation = {}) {
  return toReservationView({
    ...reservation,
    linkedCustomer: customer,
    customerSummary: {
      id: customer.id,
      firstName: customer.first_name || reservation.guest_first_name || "",
      lastName: customer.last_name || reservation.guest_last_name || "",
      email: customer.email || reservation.guest_email || "",
      phone: customer.phone || reservation.guest_phone || "",
      role: "Réservataire principal",
    },
  });
}

export function buildCustomerReservationMap(customers = [], reservations = []) {
  const map = new Map();

  for (const customer of customers) {
    const linkedReservations = reservations
      .filter((reservation) => isCustomerLinkedToReservation(customer, reservation))
      .map((reservation) => toCustomerReservationView(customer, reservation))
      .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));

    map.set(customer.id, linkedReservations);
  }

  return map;
}
