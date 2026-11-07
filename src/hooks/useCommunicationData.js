import { useMemo, useState } from "react";
import { getRequestName } from "../utils/adminFormatters";

function getCustomerName(customer) {
  return [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || customer?.email || "Client";
}
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function normalizePhone(value) { return String(value || "").replace(/\D/g, ""); }
function customerMatchesReservation(customer, reservation) {
  if (!customer || !reservation) return false;
  const email = normalizeEmail(reservation.guest_email);
  const phone = normalizePhone(reservation.guest_phone);
  return Boolean(
    (email && normalizeEmail(customer.email) === email)
    || (phone && normalizePhone(customer.phone) === phone)
    || (reservation.guest_first_name && reservation.guest_last_name
      && normalizeEmail(customer.first_name) === normalizeEmail(reservation.guest_first_name)
      && normalizeEmail(customer.last_name) === normalizeEmail(reservation.guest_last_name))
  );
}
function customerFor(reservation, customers) {
  return customers.find((item) => customerMatchesReservation(item, reservation)) || null;
}
function buildClientItem(reservation, customers) {
  if (!String(reservation?.message || "").trim()) return null;
  return {
    id: `client-${reservation.id}`, type: "message", date: reservation.created_at,
    title: `Client · ${getRequestName(reservation)}`,
    description: reservation.message, reservation,
    customer: customerFor(reservation, customers), raw: reservation,
  };
}
// A historical owner_message field was also used for non-communication data.
// Never state that it was sent to the guest: explicit provenance protects against misleading history.
function buildHistoricalOwnerNoteItem(reservation, customers) {
  if (!String(reservation?.owner_message || "").trim()) return null;
  return {
    id: `owner-note-${reservation.id}`, type: "owner_note", date: reservation.created_at,
    title: "Propriétaire · archive (envoi non confirmé)", description: reservation.owner_message,
    reservation, customer: customerFor(reservation, customers), raw: reservation,
  };
}
const MANUAL_REPLY_EVENTS = new Set(["booking_refused", "booking_confirmed_manual"]);
function buildManualReplyItem(event, reservations, customers) {
  if (!MANUAL_REPLY_EVENTS.has(String(event.event_type || "")) || !String(event.message || "").trim()) return null;
  const reservation = reservations.find((item) => item.id === event.booking_request_id) || null;
  return {
    id: `owner-event-${event.id || event.created_at}`, type: "owner_reply", date: event.created_at,
    title: "Propriétaire · réponse enregistrée (envoi non confirmé)", description: event.message,
    reservation, customer: reservation ? customerFor(reservation, customers) : null, raw: event,
  };
}

export function useCommunicationData({ bookingRequests = [], customers = [], bookingEvents = [], selectedReservation = null, selectedCustomer = null }) {
  const [context, setContext] = useState(null);
  const timeline = useMemo(() => {
    const clientItems = bookingRequests.map((item) => buildClientItem(item, customers)).filter(Boolean);
    const ownerNotes = bookingRequests.map((item) => buildHistoricalOwnerNoteItem(item, customers)).filter(Boolean);
    const replies = bookingEvents.map((event) => buildManualReplyItem(event, bookingRequests, customers)).filter(Boolean);
    return [...clientItems, ...ownerNotes, ...replies]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [bookingRequests, customers, bookingEvents]);
  const activeReservation = context === null ? selectedReservation : (context.reservation || null);
  const activeCustomer = context === null ? selectedCustomer : (context.customer || null);
  const filteredTimeline = useMemo(() => {
    if (activeReservation?.id) return timeline.filter((item) => item.reservation?.id === activeReservation.id);
    if (activeCustomer?.id) return timeline.filter((item) => item.customer?.id === activeCustomer.id);
    return timeline;
  }, [timeline, activeReservation, activeCustomer]);
  return { context, setContext, activeReservation, activeCustomer, timeline: filteredTimeline,
    allTimeline: timeline, getCustomerName, stats: {
      totalItems: filteredTimeline.length,
      messages: filteredTimeline.filter((item) => item.type === "message").length,
      owner: filteredTimeline.filter((item) => item.type === "owner_note" || item.type === "owner_reply").length,
    },
  };
}
