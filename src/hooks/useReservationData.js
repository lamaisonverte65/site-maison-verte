import { useMemo } from "react";
import { reservationSearchText, toReservationView, toReservationViews } from "../adapters/reservationViewAdapter";

export function useReservationData({
  bookingRequests,
  search,
  statusFilter,
  selectedRequest,
  payments,
  bookingEvents,
  emailLogs,
}) {
  const normalizedSearch = search.trim().toLowerCase();

  const reservationViews = useMemo(() => toReservationViews(bookingRequests), [bookingRequests]);
  const selectedReservation = useMemo(() => selectedRequest ? toReservationView(selectedRequest) : null, [selectedRequest]);

  const filteredRequests = useMemo(() => reservationViews.filter((request) => {
    const status = request.status || "pending";
    const matchesStatus = statusFilter === "all" || status === statusFilter || (statusFilter === "paid_group" && ["deposit_paid", "paid", "fully_paid", "confirmed"].includes(status));
    return matchesStatus && reservationSearchText(request).includes(normalizedSearch);
  }), [reservationViews, normalizedSearch, statusFilter]);

  const sortedReservations = useMemo(() => [...filteredRequests].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [filteredRequests]);

  const pendingRequests = useMemo(
    () => reservationViews
      .filter((request) => (request.status || "pending") === "pending")
      .filter((request) => reservationSearchText(request).includes(normalizedSearch))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [reservationViews, normalizedSearch]
  );

  const selectedPayments = useMemo(() => selectedReservation ? payments.filter((payment) => payment.booking_request_id === selectedReservation.id) : [], [payments, selectedReservation]);
  const selectedEvents = useMemo(() => selectedReservation ? bookingEvents.filter((item) => item.booking_request_id === selectedReservation.id) : [], [bookingEvents, selectedReservation]);
  const selectedEmailLogs = useMemo(() => selectedReservation ? emailLogs.filter((item) => item.booking_request_id === selectedReservation.id) : [], [emailLogs, selectedReservation]);

  const selectedReservationData = useMemo(() => ({
    payments: selectedPayments,
    events: selectedEvents,
    emailLogs: selectedEmailLogs,
  }), [selectedPayments, selectedEvents, selectedEmailLogs]);

  return {
    filteredRequests,
    sortedReservations,
    pendingRequests,
    selectedReservation,
    selectedReservationData,
  };
}
