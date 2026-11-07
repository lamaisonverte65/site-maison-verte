import { normalizeSource } from "./adminFormatters.js";

// A single registry row represents a platform reservation, not a Stripe charge.
// Never turn an unknown imported amount into zero or infer that a platform paid it.
export function paymentSource(source) {
  const label = normalizeSource(source);
  if (label === "Booking") return "booking";
  if (label === "Airbnb") return "airbnb";
  if (["Site", "Téléphone", "Google", "Facebook"].includes(label) ||
      ["admin_client", "admin_direct", "admin", "manual"].includes(String(source || "").toLowerCase())) return "site";
  if (!String(source || "").trim()) return "site";
  return "other";
}

function finiteMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function registryGuestName(registry) {
  return registry.raw_snapshot?.booking_statement?.guest_name ||
    registry.raw_snapshot?.booking_overview?.guest_name ||
    registry.raw_snapshot?.airbnb_statement?.guest_name ||
    registry.raw_snapshot?.airbnb_reservations?.guest_name ||
    `Réservation ${registry.external_reference}`;
}

export function platformPaymentRow(financial, linkedRequest = null) {
  const source = paymentSource(financial.source);
  if (source !== "booking" && source !== "airbnb") return null;
  const net = finiteMoney(financial.net_payout);
  const gross = finiteMoney(financial.traveler_total) ?? finiteMoney(financial.accommodation_amount);
  const commission = finiteMoney(financial.commission_amount);
  const fee = finiteMoney(financial.payment_fee_amount);
  const transferred = net !== null && Boolean(financial.payment_date);
  return {
    id: `platform:${source}:${financial.external_reference}`,
    source, sourceLabel: source === "booking" ? "Booking" : "Airbnb",
    name: linkedRequest?.guest_first_name || linkedRequest?.guest_last_name
      ? [linkedRequest.guest_first_name, linkedRequest.guest_last_name].filter(Boolean).join(" ")
      : registryGuestName(financial),
    status: linkedRequest?.status || "importé",
    startDate: financial.start_date || linkedRequest?.start_date || null,
    endDate: financial.end_date || linkedRequest?.end_date || null,
    confirmedAmount: gross,
    paidClientAmount: null, // A payout to the owner is not a customer Stripe payment.
    stripeFeeAmount: null,
    stripeNetAmount: null,
    stripeFinancialsComplete: false,
    platformNetAmount: net,
    commissionAmount: commission,
    platformFeeAmount: fee,
    cleaningFeeAmount: finiteMoney(financial.cleaning_fee),
    touristTaxAmount: finiteMoney(financial.tourist_tax_amount),
    paymentDate: financial.payment_date || null,
    paymentReference: financial.payment_reference || null,
    externalReference: financial.external_reference,
    bookingRequestId: financial.booking_request_id || linkedRequest?.id || null,
    paymentState: transferred ? "Versement renseigné" : net !== null ? "Net importé · date inconnue" : "À rapprocher",
    payoutIds: [],
    relatedTransactions: [],
    depositStatus: "non applicable", balanceStatus: "non applicable",
    amounts: { deposit: null, balance: null },
    stripeTransferStatus: "non applicable",
    provenance: financial.provenance || {},
  };
}

export function mergePlatformPaymentRows(siteRows = [], financials = [], bookingRequests = []) {
  const linkedRequests = new Map(bookingRequests.map((r) => [String(r.id), r]));
  const financialByRequest = new Map();
  const externalRows = [];
  const knownPlatformIds = new Set();
  for (const f of financials) {
    const source = paymentSource(f.source);
    if (source !== "booking" && source !== "airbnb") continue;
    const request = f.booking_request_id ? linkedRequests.get(String(f.booking_request_id)) : null;
    if (request && paymentSource(request.source) === source) {
      financialByRequest.set(String(request.id), f);
      knownPlatformIds.add(String(request.id));
    } else {
      const row = platformPaymentRow(f, null);
      if (row) externalRows.push(row);
    }
  }
  const merged = siteRows.map((r) => {
    if (!financialByRequest.has(String(r.id))) return r;
    return platformPaymentRow(financialByRequest.get(String(r.id)), linkedRequests.get(String(r.id)));
  });
  // A registry row can reference a request excluded by the base financial filter.
  for (const id of knownPlatformIds) {
    if (!merged.some((row) => row.bookingRequestId === id || row.id === `platform:${paymentSource(linkedRequests.get(id)?.source)}:${financialByRequest.get(id)?.external_reference}`)) {
      const financial = financialByRequest.get(id);
      externalRows.push(platformPaymentRow(financial, linkedRequests.get(id)));
    }
  }
  return [...merged, ...externalRows];
}
