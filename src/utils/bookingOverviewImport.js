import { matchBookingStatementReservations, parseCsvRows, repairBookingText } from "./bookingStatementImport.js";

const clean = (value) => repairBookingText(String(value ?? "")).replace(/^\uFEFF/, "").trim();
const normalize = (value) => clean(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function parseNullableAmount(value, label, line) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`Montant Booking Overview invalide (${label}, ligne ${line}) : ${raw}`);
  return Math.round(parsed * 100) / 100;
}

function parseNullableInteger(value, label, line) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Entier Booking Overview invalide (${label}, ligne ${line}) : ${raw}`);
  return parsed;
}

function parseIsoDate(value, label, line) {
  const raw = clean(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (!match) throw new Error(`Date Booking Overview invalide (${label}, ligne ${line}) : ${raw}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function field(row, headers, name) {
  const index = headers.indexOf(name);
  return index >= 0 ? clean(row[index]) : "";
}

export const BOOKING_OVERVIEW_REQUIRED_HEADERS = [
  "reservation number", "arrival", "departure", "guest name", "persons",
  "room nights", "original amount", "final amount", "commission amount",
  "payment fee", "currency",
];

export function isBookingOverviewHeaders(headers) {
  const normalized = headers.map(normalize);
  return BOOKING_OVERVIEW_REQUIRED_HEADERS.every((name) => normalized.includes(name));
}

export function parseBookingOverview(text) {
  const csv = parseCsvRows(text);
  if (csv.length < 2) throw new Error("Le relevé Booking Overview est vide.");
  const headers = csv[0].map(normalize);
  const missing = BOOKING_OVERVIEW_REQUIRED_HEADERS.filter((name) => !headers.includes(name));
  if (missing.length) throw new Error(`Colonnes Booking Overview manquantes : ${missing.join(", ")}.`);

  const items = csv.slice(1).map((row, index) => {
    const line = index + 2;
    return {
      line,
      reservationNumber: field(row, headers, "reservation number"),
      invoiceNumber: field(row, headers, "invoice number") || null,
      bookedOn: field(row, headers, "booked on") || null,
      arrivalDate: parseIsoDate(field(row, headers, "arrival"), "Arrival", line),
      checkoutDate: parseIsoDate(field(row, headers, "departure"), "Departure", line),
      bookerName: field(row, headers, "booker name") || null,
      guestName: field(row, headers, "guest name") || null,
      rooms: parseNullableInteger(field(row, headers, "rooms"), "Rooms", line),
      persons: parseNullableInteger(field(row, headers, "persons"), "Persons", line),
      nights: parseNullableInteger(field(row, headers, "room nights"), "Room nights", line),
      commissionRate: parseNullableAmount(field(row, headers, "commission %"), "Commission %", line),
      originalAmount: parseNullableAmount(field(row, headers, "original amount"), "Original amount", line),
      finalAmount: parseNullableAmount(field(row, headers, "final amount"), "Final amount", line),
      commissionAmount: parseNullableAmount(field(row, headers, "commission amount"), "Commission amount", line),
      paymentFee: parseNullableAmount(field(row, headers, "payment fee"), "Payment fee", line),
      status: field(row, headers, "status") || null,
      guestRequest: field(row, headers, "guest request") || null,
      currency: field(row, headers, "currency") || null,
      hotelId: field(row, headers, "hotel id") || null,
      propertyName: field(row, headers, "property name") || null,
      city: field(row, headers, "city") || null,
      country: field(row, headers, "country") || null,
    };
  });
  return { source: "booking", format: "booking_overview", items };
}


export function matchBookingOverviewReservations(overview, externalReservations = [], bookingRequests = []) {
  const adapted = {
    ...overview,
    items: (overview.items || []).map((item) => ({
      ...item,
      kind: "reservation",
      guestName: item.guestName,
    })),
  };
  const matched = matchBookingStatementReservations(adapted, externalReservations, bookingRequests);
  return {
    ...overview,
    items: matched.items.map(({ kind, ...item }) => item),
  };
}
