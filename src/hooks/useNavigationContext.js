import { useState } from "react";
import { resolveCustomerForBooking } from "../utils/adminRecordLinks";

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

  function openCustomerFromReservation(reservation, originTab = "reservations") {
    const customer = resolveCustomerForBooking(customers, reservation);

    if (!customer) {
      alert("Aucune fiche client reliée automatiquement à cette réservation. Vérifie l'email, le téléphone ou le nom du client.");
      return;
    }

    openCustomer(customer, originTab);
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
