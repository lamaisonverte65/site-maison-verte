import { useMemo, useState } from "react";
import { getRequestName } from "../utils/adminFormatters";

function getCustomerName(customer) {
  return [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.email || "Client";
}

function sameEmail(a, b) {
  return a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function samePhone(a, b) {
  return a && b && String(a).replace(/\s/g, "") === String(b).replace(/\s/g, "");
}

function customerMatchesReservation(customer, reservation) {
  if (!customer || !reservation) return false;
  return (
    sameEmail(customer.email, reservation.guest_email) ||
    samePhone(customer.phone, reservation.guest_phone) ||
    (
      customer.first_name &&
      customer.last_name &&
      reservation.guest_first_name &&
      reservation.guest_last_name &&
      String(customer.first_name).toLowerCase() === String(reservation.guest_first_name).toLowerCase() &&
      String(customer.last_name).toLowerCase() === String(reservation.guest_last_name).toLowerCase()
    )
  );
}

function buildEmailItem(emailLog, reservations, customers) {
  const reservation = reservations.find((item) => item.id === emailLog.booking_request_id) || null;
  const customer = reservation
    ? customers.find((item) => customerMatchesReservation(item, reservation)) || null
    : customers.find((item) => sameEmail(item.email, emailLog.to_email)) || null;

  return {
    id: `email-${emailLog.id || emailLog.created_at}`,
    type: "email",
    date: emailLog.sent_at || emailLog.created_at,
    title: emailLog.subject || emailLog.email_type || "Email envoyé",
    description: `${emailLog.to_email || "destinataire non renseigné"}${emailLog.status ? ` · ${emailLog.status}` : ""}`,
    reservation,
    customer,
    raw: emailLog,
  };
}

function buildEventItem(event, reservations, customers) {
  const reservation = reservations.find((item) => item.id === event.booking_request_id) || null;
  const customer = reservation ? customers.find((item) => customerMatchesReservation(item, reservation)) || null : null;

  return {
    id: `event-${event.id || event.created_at}`,
    type: "event",
    date: event.created_at,
    title: event.label || event.event_type || "Action",
    description: event.message || "Action historisée",
    reservation,
    customer,
    raw: event,
  };
}

function buildReservationMessageItem(reservation, customers) {
  if (!reservation?.message) return null;
  const customer = customers.find((item) => customerMatchesReservation(item, reservation)) || null;

  return {
    id: `message-${reservation.id}`,
    type: "message",
    date: reservation.created_at,
    title: `Message client · ${getRequestName(reservation)}`,
    description: reservation.message,
    reservation,
    customer,
    raw: reservation,
  };
}

export function useCommunicationData({
  bookingRequests = [],
  customers = [],
  emailLogs = [],
  bookingEvents = [],
  selectedReservation = null,
  selectedCustomer = null,
}) {
  const [context, setContext] = useState(null);

  const timeline = useMemo(() => {
    const emailItems = emailLogs.map((emailLog) => buildEmailItem(emailLog, bookingRequests, customers));
    const eventItems = bookingEvents.map((event) => buildEventItem(event, bookingRequests, customers));
    const messageItems = bookingRequests.map((reservation) => buildReservationMessageItem(reservation, customers)).filter(Boolean);

    return [...emailItems, ...eventItems, ...messageItems]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [bookingRequests, customers, emailLogs, bookingEvents]);

  const activeReservation = context?.reservation || selectedReservation || null;
  const activeCustomer = context?.customer || selectedCustomer || null;

  const filteredTimeline = useMemo(() => {
    if (activeReservation?.id) {
      return timeline.filter((item) => item.reservation?.id === activeReservation.id);
    }
    if (activeCustomer?.id) {
      return timeline.filter((item) => item.customer?.id === activeCustomer.id);
    }
    return timeline;
  }, [timeline, activeReservation, activeCustomer]);

  const emailHistory = useMemo(
    () => filteredTimeline.filter((item) => item.type === "email"),
    [filteredTimeline]
  );

  const templates = useMemo(() => ([
    { key: "acceptation", label: "Acceptation", description: "Réponse positive avec lien d'acompte ou paiement total." },
    { key: "refus", label: "Refus", description: "Réponse négative personnalisable." },
    { key: "solde", label: "Solde", description: "Relance ou envoi du lien de paiement du solde." },
    { key: "livret", label: "Livret d'accueil", description: "Envoi des informations pratiques avant séjour." },
    { key: "avis", label: "Demande d'avis", description: "Demande d'avis après séjour." },
    { key: "fidelite", label: "Fidélité", description: "Message clients fidèles ou anciens clients." },
  ]), []);

  return {
    context,
    setContext,
    activeReservation,
    activeCustomer,
    timeline: filteredTimeline,
    allTimeline: timeline,
    emailHistory,
    templates,
    stats: {
      totalItems: filteredTimeline.length,
      emails: emailHistory.length,
      events: filteredTimeline.filter((item) => item.type === "event").length,
      messages: filteredTimeline.filter((item) => item.type === "message").length,
    },
    getCustomerName,
  };
}
