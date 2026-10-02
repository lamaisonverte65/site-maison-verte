const money = (value) => value == null || value === "" ? null : Math.round(Math.abs(Number(value)) * 100) / 100;
const nonblank = (value) => String(value ?? "").trim() || null;
const cents = (value) => Math.round(Number(value) * 100);

// Périmètre métier explicitement confirmé : dans l'export Booking Overview audité
// jusqu'au 31/08/2026, le forfait ménage Booking n'était pas encore paramétré.
// Cette borne évite de transformer ce constat historique en règle pour les séjours futurs.
export const BOOKING_CONFIRMED_NO_CLEANING_THROUGH = "2026-08-31";

function mergeObject(left, right) {
  return { ...(left || {}), ...(right || {}) };
}

function sourcePriority(provenanceValue) {
  if (String(provenanceValue || "").startsWith("booking_statement:")) return 30;
  if (String(provenanceValue || "").startsWith("booking_overview:")) return 20;
  if (String(provenanceValue || "").startsWith("derived:")) return 10;
  return 0;
}

function pickByProvenance(existing, incoming, field) {
  const incomingValue = incoming[field];
  const existingValue = existing[field];
  if (incomingValue == null) return existingValue ?? null;
  if (existingValue == null) return incomingValue;
  const incomingPriority = sourcePriority(incoming.provenance?.[field]);
  const existingPriority = sourcePriority(existing.provenance?.[field]);
  return incomingPriority >= existingPriority ? incomingValue : existingValue;
}

export function bookingStatementToFinancialRows(statement) {
  const byReference = new Map();
  for (const item of statement.items || []) {
    if (item.kind !== "reservation" || !item.reservationNumber) continue;
    const key = String(item.reservationNumber);
    const row = {
      source: "booking",
      external_reference: key,
      booking_request_id: item.matchedBookingRequestId || null,
      currency: nonblank(item.currency)?.toLowerCase() || "eur",
      start_date: item.arrivalDate || null,
      end_date: item.checkoutDate || null,
      nights: null,
      adults_count: null,
      children_count: null,
      accommodation_amount: null,
      cleaning_fee: null,
      tourist_tax_amount: null,
      traveler_total: money(item.gross),
      commission_amount: money(item.commission),
      payment_fee_amount: money(item.paymentFee),
      net_payout: money(item.net),
      payment_date: item.paymentDate || null,
      payment_reference: nonblank(item.paymentId),
      provenance: {
        traveler_total: "booking_statement:montant",
        commission_amount: "booking_statement:commission",
        payment_fee_amount: "booking_statement:frais_service_paiement",
        net_payout: "booking_statement:net",
        payment_date: "booking_statement:date_paiement",
        payment_reference: "booking_statement:identifiant_paiement",
      },
      raw_snapshot: {
        booking_statement: {
          line: item.line,
          type: item.type || null,
          reservation_number: key,
          guest_name: item.guestName || null,
          booking_status: item.bookingStatus || null,
          payment_status: item.paymentStatus || null,
          gross: item.gross,
          commission: item.commission,
          payment_fee: item.paymentFee,
          net: item.net,
        },
      },
    };
    const previous = byReference.get(key);
    byReference.set(key, previous ? mergeExternalFinancialRow(previous, row) : row);
  }
  return [...byReference.values()];
}

export function bookingOverviewToFinancialRows(overview) {
  return (overview.items || [])
    .filter((item) => item.reservationNumber)
    .map((item) => ({
      source: "booking",
      external_reference: String(item.reservationNumber),
      booking_request_id: item.matchedBookingRequestId || null,
      currency: nonblank(item.currency)?.toLowerCase() || "eur",
      start_date: item.arrivalDate || null,
      end_date: item.checkoutDate || null,
      nights: item.nights ?? null,
      adults_count: null,
      children_count: null,
      accommodation_amount: null,
      cleaning_fee: null,
      tourist_tax_amount: null,
      traveler_total: null,
      commission_amount: money(item.commissionAmount),
      payment_fee_amount: money(item.paymentFee),
      net_payout: null,
      payment_date: null,
      payment_reference: null,
      provenance: {
        nights: "booking_overview:room_nights",
        commission_amount: "booking_overview:commission_amount",
        payment_fee_amount: "booking_overview:payment_fee",
        original_amount: "booking_overview:original_amount",
        final_amount: "booking_overview:final_amount",
        persons: "booking_overview:persons",
      },
      raw_snapshot: {
        booking_overview: {
          line: item.line,
          invoice_number: item.invoiceNumber || null,
          booked_on: item.bookedOn || null,
          guest_name: item.guestName || null,
          persons: item.persons ?? null,
          rooms: item.rooms ?? null,
          room_nights: item.nights ?? null,
          commission_rate: item.commissionRate ?? null,
          original_amount: item.originalAmount,
          final_amount: item.finalAmount,
          commission_amount: item.commissionAmount,
          payment_fee: item.paymentFee,
          status: item.status || null,
        },
      },
    }));
}

export function deriveBookingHistoricalBreakdown(row) {
  if (row?.source !== "booking") return row;
  const overview = row.raw_snapshot?.booking_overview;
  const statement = row.raw_snapshot?.booking_statement;
  if (!overview || !statement) return row;
  if (!row.start_date || row.start_date > BOOKING_CONFIRMED_NO_CLEANING_THROUGH) return row;

  const accommodation = money(overview.final_amount);
  const travelerTotal = money(row.traveler_total);
  if (accommodation == null || travelerTotal == null || cents(travelerTotal) < cents(accommodation)) return row;

  const cleaning = 0;
  const touristTax = Math.round((travelerTotal - accommodation) * 100) / 100;
  if (cents(accommodation) + cents(cleaning) + cents(touristTax) !== cents(travelerTotal)) return row;

  return {
    ...row,
    accommodation_amount: accommodation,
    cleaning_fee: cleaning,
    tourist_tax_amount: touristTax,
    provenance: {
      ...(row.provenance || {}),
      accommodation_amount: "derived:booking_overview:final_amount",
      cleaning_fee: `business_rule:booking_no_cleaning_confirmed_through_${BOOKING_CONFIRMED_NO_CLEANING_THROUGH}`,
      tourist_tax_amount: "derived:traveler_total_minus_accommodation_minus_cleaning",
      financial_breakdown_check: "derived:components_equal_traveler_total",
    },
  };
}

export function buildBookingInvoiceCandidate(row) {
  if (!row || row.source !== "booking") return { ready: false, reason: "not_booking" };
  const values = [row.accommodation_amount, row.cleaning_fee, row.tourist_tax_amount, row.traveler_total];
  if (values.some((value) => value == null || !Number.isFinite(Number(value)) || Number(value) < 0)) {
    return { ready: false, reason: "financial_breakdown_incomplete", external_reference: row.external_reference || null };
  }
  const accommodation = money(row.accommodation_amount);
  const cleaning = money(row.cleaning_fee);
  const touristTax = money(row.tourist_tax_amount);
  const total = money(row.traveler_total);
  if (cents(accommodation) + cents(cleaning) + cents(touristTax) !== cents(total)) {
    return { ready: false, reason: "financial_breakdown_mismatch", external_reference: row.external_reference || null };
  }
  return {
    ready: true,
    source: "booking",
    external_reference: row.external_reference,
    booking_request_id: row.booking_request_id || null,
    financial_snapshot: {
      accommodation_net: accommodation,
      cleaning_fee: cleaning,
      tourist_tax_amount: touristTax,
      contract_total: total,
      invoice_ready: true,
      draft_origin: "booking_external_financial_registry",
    },
    total_amount: total,
  };
}

export function mergeExternalFinancialRow(existing, incoming) {
  const fields = [
    "booking_request_id", "currency", "start_date", "end_date", "nights",
    "adults_count", "children_count", "accommodation_amount", "cleaning_fee",
    "tourist_tax_amount", "traveler_total", "commission_amount",
    "payment_fee_amount", "net_payout", "payment_date", "payment_reference",
  ];
  const merged = {
    source: incoming.source || existing.source,
    external_reference: incoming.external_reference || existing.external_reference,
  };
  for (const field of fields) merged[field] = pickByProvenance(existing, incoming, field);
  merged.provenance = mergeObject(existing.provenance, incoming.provenance);
  merged.raw_snapshot = mergeObject(existing.raw_snapshot, incoming.raw_snapshot);

  // Les champs Statement restent prioritaires si un Overview est réimporté ensuite.
  for (const field of ["traveler_total", "commission_amount", "payment_fee_amount", "net_payout", "payment_date", "payment_reference"]) {
    if (sourcePriority(existing.provenance?.[field]) > sourcePriority(incoming.provenance?.[field])) {
      merged.provenance[field] = existing.provenance[field];
    }
  }
  return deriveBookingHistoricalBreakdown(merged);
}
