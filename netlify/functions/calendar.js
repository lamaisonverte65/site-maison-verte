import { createClient } from "@supabase/supabase-js";
import { loadPersistedExternalCalendar } from "./_lib/external-calendar-display.js";

export function createCalendarSupabaseClient(env = process.env, factory = createClient) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configuration serveur manquante : SUPABASE_SERVICE_ROLE_KEY est requise pour le calendrier.");
  }
  return factory(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const BLOCKING_BOOKING_STATUSES = [
  "pending",
  "accepted",
  "deposit_paid",
  "paid",
  "fully_paid",
  "confirmed",
];

function toDateString(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const key = toDateString(value);
  const [year, month, day] = key.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function getDatesBetween(startDate, endDate) {
  const dates = [];
  const current = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  while (current < end) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}


export function enrichExternalReservationsFromAccounting(externalReservations = [], accountingEntries = []) {
  const candidates = new Map();

  for (const entry of accountingEntries || []) {
    const source = String(entry?.source || "").toLowerCase();
    const metadata = entry?.metadata || {};
    const guestName = String(metadata.guest_name || "").trim();
    const startDate = String(metadata.arrival_date || "").slice(0, 10);
    const endDate = String(metadata.checkout_date || "").slice(0, 10);
    const uid = String(metadata.external_calendar_uid || "").trim();
    if (!guestName || !["booking", "airbnb"].includes(source)) continue;

    const keys = [];
    if (uid) keys.push(`${source}|uid|${uid}`);
    if (startDate && endDate) keys.push(`${source}|dates|${startDate}|${endDate}`);
    for (const key of keys) {
      if (!candidates.has(key)) candidates.set(key, new Set());
      candidates.get(key).add(guestName);
    }
  }

  return (externalReservations || []).map((reservation) => {
    const source = String(reservation?.source || "").toLowerCase();
    const uidKey = `${source}|uid|${String(reservation?.uid || "").trim()}`;
    const datesKey = `${source}|dates|${String(reservation?.start_date || "").slice(0, 10)}|${String(reservation?.end_date || "").slice(0, 10)}`;
    const uidNames = reservation?.uid ? candidates.get(uidKey) : null;
    const dateNames = candidates.get(datesKey);
    const names = uidNames?.size ? uidNames : dateNames;
    if (!names || names.size !== 1) return reservation;
    const [guestName] = [...names];
    return { ...reservation, guest_name: guestName, title: guestName, accounting_match: true };
  });
}

export async function handler() {
  try {
    const supabase = createCalendarSupabaseClient();
    const unavailableDates = [];
    const departureOnlyDates = [];
    const persistentCalendar = await loadPersistedExternalCalendar({
      async getCurrentOccupancies() {
        const { data, error } = await supabase.from("external_occupancies")
          .select("id,source,external_uid,start_date,end_date,is_current")
          .eq("is_current", true);
        if (error) throw error;
        return data || [];
      },
      async getSuccessfulSyncs() {
        const { data, error } = await supabase.from("external_occupancy_conflict_runs")
          .select("source,last_reconciled_at");
        if (error) throw error;
        return data || [];
      },
    });
    unavailableDates.push(...persistentCalendar.unavailableDates);
    departureOnlyDates.push(
      ...persistentCalendar.externalReservations.map((reservation) => reservation.start_date)
    );
    let externalReservations = persistentCalendar.externalReservations;

    // Les exports comptables Booking/Airbnb contiennent le nom du voyageur.
    // On les utilise uniquement comme enrichissement d'affichage : l'iCal reste
    // l'autorité sur l'occupation et aucune réservation externe n'est transformée
    // en réservation directe. Un rapprochement ambigu reste volontairement sans nom.
    const { data: accountingEntries, error: accountingEntriesError } = await supabase
      .from("accounting_entries")
      .select("source,metadata")
      .in("source", ["booking", "airbnb"])
      .eq("entry_kind", "income");

    if (accountingEntriesError) {
      console.error("Erreur enrichissement comptable calendrier :", accountingEntriesError);
    } else {
      externalReservations = enrichExternalReservationsFromAccounting(externalReservations, accountingEntries || []);
    }

    const { data: bookingRequests, error: bookingRequestsError } = await supabase
      .from("booking_requests")
      .select("id,start_date,end_date,status")
      .in("status", BLOCKING_BOOKING_STATUSES);

    if (bookingRequestsError) {
      console.error("Erreur booking_requests calendrier :", bookingRequestsError);
    }

    for (const booking of bookingRequests || []) {
      departureOnlyDates.push(booking.start_date);
      unavailableDates.push(
        ...getDatesBetween(booking.start_date, booking.end_date)
      );
    }

    const { data: calendarBlocks, error: calendarBlocksError } = await supabase
      .from("calendar_blocks")
      .select("id,start_date,end_date,status");

    if (calendarBlocksError) {
      console.error("Erreur calendar_blocks calendrier :", calendarBlocksError);
    }

    for (const block of calendarBlocks || []) {
      departureOnlyDates.push(block.start_date);
      unavailableDates.push(
        ...getDatesBetween(block.start_date, block.end_date)
      );
    }


    const { data: pricingSettings, error: pricingSettingsError } = await supabase
      .from("pricing_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (pricingSettingsError) {
      console.error("Erreur pricing_settings calendrier :", pricingSettingsError);
    }

    const { data: seasonPrices, error: seasonPricesError } = await supabase
      .from("season_prices")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: true });

    if (seasonPricesError) {
      console.error("Erreur season_prices calendrier :", seasonPricesError);
    }

    const { data: priceOverrides, error: priceOverridesError } = await supabase
      .from("price_overrides")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: true });

    if (priceOverridesError) {
      console.error("Erreur price_overrides calendrier :", priceOverridesError);
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
      body: JSON.stringify({
        unavailableDates: [...new Set(unavailableDates)].sort(),
        departureOnlyDates: [...new Set(departureOnlyDates)].sort(),
        externalReservations,
        externalCalendarSyncStatus: persistentCalendar.syncStatus,
        defaultNightPrice: Number(pricingSettings?.default_night_price || 80),
        seasonPrices: seasonPrices || [],
        priceOverrides: priceOverrides || [],
      }),
    };
  } catch (error) {
    console.error("Erreur calendrier :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}
