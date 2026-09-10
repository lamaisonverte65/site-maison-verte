import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BLOCKING_BOOKING_STATUSES = [
  "pending",
  "accepted",
  "deposit_paid",
  "paid",
  "fully_paid",
  "confirmed",
];

function formatDateForIcal(dateString) {
  return dateString.replaceAll("-", "");
}

function escapeText(text = "") {
  return String(text)
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function createEvent({ uid, start_date, end_date, title, description, now = new Date() }) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;VALUE=DATE:${formatDateForIcal(start_date)}`,
    `DTEND;VALUE=DATE:${formatDateForIcal(end_date)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "END:VEVENT",
  ].join("\r\n");
}

export function buildIcalCalendar({ blocks = [], requests = [], now = new Date() } = {}) {
  const blockEvents = blocks.map((block) =>
    createEvent({
      uid: `block-${block.id}@lamaisonverte65.fr`,
      start_date: block.start_date,
      end_date: block.end_date,
      title: "Indisponible",
      description: "Période indisponible",
      now,
    })
  );

  const requestEvents = requests
    .filter((request) => BLOCKING_BOOKING_STATUSES.includes(request.status))
    .map((request) =>
      createEvent({
        uid: `request-${request.id}@lamaisonverte65.fr`,
        start_date: request.start_date,
        end_date: request.end_date,
        title: "Réservation directe - La Maison Verte",
        description: "Période indisponible",
        now,
      })
    );

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Maison Verte//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...blockEvents,
    ...requestEvents,
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function handler() {
  try {
    const { data: blocks, error: blocksError } = await supabase
      .from("calendar_blocks")
      .select("id,start_date,end_date");

    if (blocksError) throw blocksError;

    const { data: requests, error: requestsError } = await supabase
      .from("booking_requests")
      .select("id,start_date,end_date,status")
      .in("status", BLOCKING_BOOKING_STATUSES);

    if (requestsError) throw requestsError;

    const calendar = buildIcalCalendar({ blocks, requests });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=la-maison-verte.ics",
      },
      body: calendar,
    };
  } catch (error) {
    console.error("Erreur export iCal :", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}
