import express from "express";
import cors from "cors";
import ical from "node-ical";

const app = express();

app.use(cors());

const AIRBNB_ICAL =
  "https://www.airbnb.fr/calendar/ical/1085595615567954443.ics?t=1c21fc3fb6c148a88881e014b47a1be6";

const BOOKING_ICAL =
  "https://ical.booking.com/v1/export?t=59597c14-dea1-451a-9276-ceb3d80097a9";

app.get("/api/calendar", async (req, res) => {

  try {

    const airbnbData =
      await ical.async.fromURL(AIRBNB_ICAL);

    const bookingData =
      await ical.async.fromURL(BOOKING_ICAL);

    const unavailableDates = [];

    function extractDates(data) {

      for (const key in data) {

        const event = data[key];

        if (event.type === "VEVENT") {

          const start = new Date(event.start);
          const end = new Date(event.end);

          for (
            let d = new Date(start);
            d < end;
            d.setDate(d.getDate() + 1)
          ) {

            unavailableDates.push(
              d.toISOString().split("T")[0]
            );

          }

        }

      }

    }

    extractDates(airbnbData);
    extractDates(bookingData);

    res.json({
      unavailableDates
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Erreur calendrier"
    });

  }

});

app.listen(3001, () => {

  console.log(
    "Serveur calendrier lancé sur port 3001"
  );

});