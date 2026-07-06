import { useState } from "react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function findCustomerForReservation(customers, reservation) {
  if (!reservation) return null;

  const reservationEmail = normalizeText(reservation.guest_email);
  const reservationPhone = normalizePhone(reservation.guest_phone);
  const reservationFirstName = normalizeText(reservation.guest_first_name);
  const reservationLastName = normalizeText(reservation.guest_last_name);

  return (customers || []).find((customer) => {
    const sameEmail = reservationEmail && normalizeText(customer.email) === reservationEmail;
    const samePhone = reservationPhone && normalizePhone(customer.phone) === reservationPhone;
    const sameName = reservationFirstName && reservationLastName
      && normalizeText(customer.first_name) === reservationFirstName
      && normalizeText(customer.last_name) === reservationLastName;

    return sameEmail || samePhone || sameName;
  }) || null;
}

export function useNavigationContext({ customers, setActiveTab, setSelectedRequest }) {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [previousTab, setPreviousTab] = useState(null);

  function openReservation(reservation, originTab = null) {
    if (!reservation) return;
    setSelectedRequest(reservation);
    setPreviousTab(originTab || "reservations");
    setActiveTab("reservations");
  }

  function openCustomer(customer, originTab = null) {
    if (!customer) return;
    setSelectedCustomer(customer);
    setPreviousTab(originTab || "customers");
    setActiveTab("customers");
  }

  function closeCustomer() {
    setSelectedCustomer(null);
  }

  function openCustomerFromReservation(reservation) {
    const customer = findCustomerForReservation(customers, reservation);

    if (!customer) {
      alert("Aucune fiche client reliée automatiquement à cette réservation. Vérifie l'email, le téléphone ou le nom du client.");
      return;
    }

    openCustomer(customer, "reservations");
  }

  function backToPreviousTab(fallbackTab = "reservations") {
    setActiveTab(previousTab || fallbackTab);
  }

  return {
    selectedCustomer,
    previousTab,
    openReservation,
    openCustomer,
    closeCustomer,
    openCustomerFromReservation,
    backToPreviousTab,
  };
}
