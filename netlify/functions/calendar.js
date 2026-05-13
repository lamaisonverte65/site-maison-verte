export async function handler() {

  try {

    const airbnbUrl =
      process.env.AIRBNB_ICAL_URL;

    const bookingUrl =
      process.env.BOOKING_ICAL_URL;
      
    const [airbnbRes, bookingRes] =
      await Promise.all([
        fetch(airbnbUrl),
        fetch(bookingUrl)
      ]);

    const airbnbText =
      await airbnbRes.text();

    const bookingText =
      await bookingRes.text();

    const combined =
      `${airbnbText}\n${bookingText}`;

    const unavailableDates = [];

    const events =
      combined.split("BEGIN:VEVENT");

    events.forEach(event => {

      const startMatch =
        event.match(/DTSTART.*:(\d{8})/);

      const endMatch =
        event.match(/DTEND.*:(\d{8})/);

      if (!startMatch || !endMatch) {
        return;
      }

      const start =
        startMatch[1];

      const end =
        endMatch[1];

      const startDate =
        new Date(
          `${start.slice(0,4)}-${start.slice(4,6)}-${start.slice(6,8)}`
        );

      const endDate =
        new Date(
          `${end.slice(0,4)}-${end.slice(4,6)}-${end.slice(6,8)}`
        );

      for (
        let d = new Date(startDate);
        d < endDate;
        d.setDate(d.getDate() + 1)
      ) {

        unavailableDates.push(
          d.toISOString().split("T")[0]
        );

      }

    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        unavailableDates: [...new Set(unavailableDates)]
      })
    };

  } catch (error) {

    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Erreur calendrier"
      })
    };

  }

}