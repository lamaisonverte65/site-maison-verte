import ical from "node-ical";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

function toDateString(date) {
  return new Date(date).toISOString().split("T")[0];
}

function getDatesBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

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

    const { data: bookingRequests } = await supabase
      .from("booking_requests")
      .select("*")
      .in("status", ["accepted", "paid", "confirmed"]);

    for (const booking of bookingRequests || []) {
      unavailableDates.push(
        ...getDatesBetween(booking.start_date, booking.end_date)
      );
    }

    const { data: calendarBlocks } = await supabase
      .from("calendar_blocks")
      .select("*");

    for (const block of calendarBlocks || []) {
      unavailableDates.push(
        ...getDatesBetween(block.start_date, block.end_date)
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        unavailableDates: [...new Set(unavailableDates)],
        externalReservations,
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