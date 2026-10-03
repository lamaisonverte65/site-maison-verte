const SELLER_SNAPSHOT = Object.freeze({
  legal_name: "Raphaël BENOIT",
  trade_name: "La Maison Verte",
  address: "4 Chemin du Calvaire",
  postal_code: "65240",
  city: "Arreau",
  country: "France",
  siret: "42228411700039",
  email: "lamaisonverte65@gmail.com",
  phone: "+33795938315",
  accommodation_name: "La Maison Verte",
  accommodation_address: "3 Impasse Trassens",
  accommodation_postal_code: "65240",
  accommodation_city: "Arreau",
  accommodation_country: "France",
  vat_treatment: "furnished_rental_exempt",
  vat_legal_basis: "CGI art. 261 D, 4°",
});

const DIRECT_SOURCES = new Set(["website", "direct", "admin_client"]);

const LEGACY_ACCOMMODATION_ONLY_BEFORE = "2026-09-24T00:00:00Z";

function dateKey(value) {
  return String(value || "").slice(0, 10);
}

function timestampAtOrBefore(value, cutoff) {
  if (!value) return false;
  const time = new Date(value).getTime();
  const limit = new Date(cutoff).getTime();
  return Number.isFinite(time) && Number.isFinite(limit) && time <= limit;
}

function stayNightKeys(startDate, endDate) {
  const start = new Date(`${dateKey(startDate)}T12:00:00Z`);
  const end = new Date(`${dateKey(endDate)}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return [];
  const nights = [];
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + 86400000)) {
    nights.push(cursor.toISOString().slice(0, 10));
  }
  return nights;
}

function rowAppliesToNight(row, night) {
  return night >= dateKey(row.start_date) && night < dateKey(row.end_date);
}

function historicallyUsablePricingRows(rows, bookingCreatedAt) {
  return (rows || [])
    .filter((row) => row?.is_active === true)
    .filter((row) => timestampAtOrBefore(row.created_at, bookingCreatedAt))
    .filter((row) => !row.updated_at || timestampAtOrBefore(row.updated_at, bookingCreatedAt))
    .sort((a, b) => dateKey(a.start_date).localeCompare(dateKey(b.start_date)));
}

export function reconstructLegacyDirectAccommodation({ booking, seasons = [], overrides = [] }) {
  if (!booking?.created_at || new Date(booking.created_at).getTime() >= new Date(LEGACY_ACCOMMODATION_ONLY_BEFORE).getTime()) return null;
  const referenceTotal = [booking.owner_price, booking.estimated_total, booking.gross_amount]
    .map(money).find((value) => Number.isFinite(value) && value >= 0);
  if (referenceTotal == null) return null;

  const nights = stayNightKeys(booking.start_date, booking.end_date);
  if (!nights.length) return null;
  const historicalOverrides = historicallyUsablePricingRows(overrides, booking.created_at);
  const historicalSeasons = historicallyUsablePricingRows(seasons, booking.created_at);
  const nightly = [];

  for (const night of nights) {
    const override = historicalOverrides.find((row) => rowAppliesToNight(row, night));
    const season = historicalSeasons.find((row) => rowAppliesToNight(row, night));
    const selected = override || season;
    const price = money(selected?.night_price);
    if (!selected || !Number.isFinite(price) || price < 0) return null;
    nightly.push({ date: night, price, source: override ? "price_override" : "season_price" });
  }

  const tariffTotal = Math.round(nightly.reduce((sum, row) => sum + row.price, 0) * 100) / 100;
  if (Math.abs(tariffTotal - referenceTotal) > 0.009) return null;
  return {
    referenceTotal,
    tariffTotal,
    nightly,
    method: "historical_tariff_match",
    reason: "booking_predates_cleaning_tax_promotion_and_tariff_matches_total",
  };
}

const money = (value) => value == null || value === "" ? null : Number(value);
const clean = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

function nightsBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${String(startDate).slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${String(endDate).slice(0, 10)}T12:00:00Z`);
  const nights = Math.round((end - start) / 86400000);
  return Number.isFinite(nights) && nights >= 0 ? nights : null;
}

function linkedPaymentSnapshot(booking, payments) {
  const linkedPayments = (payments || [])
    .filter((payment) => payment?.booking_request_id === booking.id)
    .map((payment) => ({
      id: payment.id,
      payment_type: clean(payment.payment_type),
      amount: money(payment.amount) ?? 0,
      currency: String(payment.currency || "eur").toLowerCase(),
      status: clean(payment.status),
      paid_at: payment.paid_at || null,
      refunded_amount: money(payment.refunded_amount) ?? 0,
      refunded_at: payment.refunded_at || null,
    }))
    .sort((a, b) => String(a.paid_at || "").localeCompare(String(b.paid_at || "")));
  const currencies = new Set(linkedPayments.map((payment) => payment.currency));
  if ([...currencies].some((currency) => currency !== "eur")) throw new Error("unsupported_payment_currency");
  return linkedPayments;
}

function baseSnapshots(booking) {
  return {
    seller_snapshot: { ...SELLER_SNAPSHOT },
    customer_snapshot: {
      first_name: clean(booking.guest_first_name), last_name: clean(booking.guest_last_name),
      email: clean(booking.guest_email), phone: clean(booking.guest_phone), address: clean(booking.guest_address),
      postal_code: clean(booking.guest_postal_code), city: clean(booking.guest_city), country: clean(booking.guest_country),
    },
    stay_snapshot: {
      start_date: booking.start_date, end_date: booking.end_date, nights: nightsBetween(booking.start_date, booking.end_date),
      adults_count: booking.adults_count == null ? null : Number(booking.adults_count),
      children_count: booking.children_count == null ? null : Number(booking.children_count),
      children_ages: Array.isArray(booking.children_ages) ? booking.children_ages : [],
      accommodation_name: SELLER_SNAPSHOT.accommodation_name, accommodation_address: SELLER_SNAPSHOT.accommodation_address,
      accommodation_postal_code: SELLER_SNAPSHOT.accommodation_postal_code, accommodation_city: SELLER_SNAPSHOT.accommodation_city,
      accommodation_country: SELLER_SNAPSHOT.accommodation_country,
    },
  };
}

export function buildLegacyDirectInvoiceDraft({ booking, payments = [] }) {
  if (!booking?.id) throw new Error("booking_required");
  if (!DIRECT_SOURCES.has(String(booking.source || "").toLowerCase())) throw new Error("direct_booking_required");
  const referenceTotal = [booking.owner_price, booking.estimated_total, booking.gross_amount]
    .map(money).find((v) => Number.isFinite(v) && v >= 0);
  if (referenceTotal == null) throw new Error("legacy_total_missing");
  return {
    source: "direct", booking_request_id: booking.id, external_reference: null, status: "draft", ...baseSnapshots(booking),
    financial_snapshot: {
      draft_origin: "legacy_direct_manual", invoice_ready: false, legacy_reference_total: referenceTotal,
      accommodation_gross: null, promotion_discount_rate: null, promotion_discount_amount: 0, accommodation_net: null,
      cleaning_fee: null, tourist_tax_amount: null, tourist_tax_collected: money(booking.tourist_tax_collected) ?? 0,
      tourist_tax_refunded: money(booking.tourist_tax_refunded) ?? 0, tourist_tax_collector: clean(booking.tourist_tax_collector),
      tourist_tax_snapshot: null, deposit_rate: null, deposit_basis: null, deposit_amount: money(booking.deposit_amount),
      contract_total: referenceTotal,
    },
    payment_snapshot: linkedPaymentSnapshot(booking, payments), currency: "eur", total_amount: referenceTotal,
  };
}

export function buildReconstructedLegacyDirectInvoiceDraft({ booking, payments = [], seasons = [], overrides = [] }) {
  const reconstruction = reconstructLegacyDirectAccommodation({ booking, seasons, overrides });
  if (!reconstruction) return null;
  const draft = buildLegacyDirectInvoiceDraft({ booking, payments });
  draft.financial_snapshot = {
    ...draft.financial_snapshot,
    invoice_ready: true,
    accommodation_gross: reconstruction.referenceTotal,
    promotion_discount_rate: null,
    promotion_discount_amount: 0,
    accommodation_net: reconstruction.referenceTotal,
    cleaning_fee: 0,
    tourist_tax_amount: 0,
    contract_total: reconstruction.referenceTotal,
    reconstruction: {
      method: reconstruction.method,
      reason: reconstruction.reason,
      tariff_total: reconstruction.tariffTotal,
      nightly: reconstruction.nightly,
      reconstructed_at: new Date().toISOString(),
    },
  };
  return draft;
}

export function buildDirectInvoiceDraft({ booking, payments = [] }) {
  if (!booking?.id) throw new Error("booking_required");
  if (!DIRECT_SOURCES.has(String(booking.source || "").toLowerCase())) throw new Error("direct_booking_required");

  const requiredMoney = [
    "accommodation_net",
    "deposit_rate",
    "deposit_basis",
    "deposit_amount",
    "contract_total",
  ];
  for (const field of requiredMoney) {
    if (money(booking[field]) == null || !Number.isFinite(money(booking[field]))) {
      throw new Error(`v410_snapshot_incomplete:${field}`);
    }
  }
  if (!booking.tourist_tax_snapshot || typeof booking.tourist_tax_snapshot !== "object") {
    throw new Error("v410_snapshot_incomplete:tourist_tax_snapshot");
  }

  const linkedPayments = linkedPaymentSnapshot(booking, payments);

  const totalAmount = money(booking.contract_total);
  if (totalAmount < 0) throw new Error("invalid_contract_total");

  return {
    source: "direct",
    booking_request_id: booking.id,
    external_reference: null,
    status: "draft",
    ...baseSnapshots(booking),
    financial_snapshot: {
      accommodation_gross: money(booking.accommodation_gross),
      promotion_discount_rate: money(booking.promotion_discount_rate),
      promotion_discount_amount: money(booking.promotion_discount_amount),
      accommodation_net: money(booking.accommodation_net),
      cleaning_fee: booking.cleaning_option === true ? (money(booking.cleaning_fee) ?? 0) : 0,
      tourist_tax_amount: money(booking.tourist_tax_amount) ?? 0,
      tourist_tax_collected: money(booking.tourist_tax_collected) ?? 0,
      tourist_tax_refunded: money(booking.tourist_tax_refunded) ?? 0,
      tourist_tax_collector: clean(booking.tourist_tax_collector),
      tourist_tax_snapshot: booking.tourist_tax_snapshot,
      deposit_rate: money(booking.deposit_rate),
      deposit_basis: money(booking.deposit_basis),
      deposit_amount: money(booking.deposit_amount),
      contract_total: totalAmount,
    },
    payment_snapshot: linkedPayments,
    currency: "eur",
    total_amount: totalAmount,
  };
}
