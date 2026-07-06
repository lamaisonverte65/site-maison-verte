import ical from "node-ical";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

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

export async function handler() {
  try {
    const unavailableDates = [];
    const externalReservations = [];

    const sources = [
      {
        url: process.env.AIRBNB_ICAL_URL,
        source: "airbnb",
        defaultName: "Client Airbnb",
      },
      {
        url: process.env.BOOKING_ICAL_URL,
        source: "booking",
        defaultName: "Client Booking",
      },
    ];

    for (const sourceConfig of sources) {
      if (!sourceConfig.url) continue;

      try {
        const events = await ical.async.fromURL(sourceConfig.url);

        for (const key in events) {
          const event = events[key];
          if (event.type !== "VEVENT") continue;

          const startDate = toDateString(event.start);
          const endDate = toDateString(event.end);
          const durationInNights = Math.round(
            (parseLocalDate(endDate) - parseLocalDate(startDate)) /
              (1000 * 60 * 60 * 24)
          );

          // Booking peut envoyer des blocages ICS isolés d'une seule nuit,
          // alors que les vraies réservations Booking ne peuvent pas être d'une nuit.
          // On les ignore à la source pour ne pas bloquer inutilement le calendrier public/admin.
          // Si Booking rattache ce jour à un événement plus long, on conserve l'événement entier
          // pour éviter de casser une vraie réservation.
          if (sourceConfig.source === "booking" && durationInNights === 1) {
            continue;
          }

          unavailableDates.push(...getDatesBetween(startDate, endDate));

          externalReservations.push({
            source: sourceConfig.source,
            start_date: startDate,
            end_date: endDate,
            title: event.summary || sourceConfig.defaultName,
            guest_name: event.summary || sourceConfig.defaultName,
            guest_email: null,
            guest_phone: null,
            uid: event.uid || null,
          });
        }
      } catch (error) {
        console.error(`Erreur ${sourceConfig.source}:`, error);
      }
    }

    const { data: bookingRequests, error: bookingRequestsError } = await supabase
      .from("booking_requests")
      .select("id,start_date,end_date,status")
      .in("status", BLOCKING_BOOKING_STATUSES);

    if (bookingRequestsError) {
      console.error("Erreur booking_requests calendrier :", bookingRequestsError);
    }

    for (const booking of bookingRequests || []) {
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
        externalReservations,
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
