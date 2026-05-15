import ical from "node-ical";

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

          const start = new Date(event.start);
          const end = new Date(event.end);

          for (
            let currentDate = new Date(start);
            currentDate < end;
            currentDate.setDate(currentDate.getDate() + 1)
          ) {
            unavailableDates.push(
              currentDate.toISOString().split("T")[0]
            );
          }

          externalReservations.push({
            source: sourceConfig.source,
            start_date: start.toISOString().split("T")[0],
            end_date: end.toISOString().split("T")[0],
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