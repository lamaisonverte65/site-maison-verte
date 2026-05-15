import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

function createEvent({ uid, start_date, end_date, title, description }) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;VALUE=DATE:${formatDateForIcal(start_date)}`,
    `DTEND;VALUE=DATE:${formatDateForIcal(end_date)}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "END:VEVENT",
  ].join("\r\n");
}

export async function handler() {
  try {
    const { data: blocks, error: blocksError } = await supabase
      .from("calendar_blocks")
      .select("*");

    if (blocksError) throw blocksError;

    const { data: requests, error: requestsError } = await supabase
      .from("booking_requests")
      .select("*")
      .in("status", ["accepted", "paid", "confirmed"]);

    if (requestsError) throw requestsError;

    const blockEvents = (blocks || []).map((block) =>
      createEvent({
        uid: `block-${block.id}@lamaisonverte65.fr`,
        start_date: block.start_date,
        end_date: block.end_date,
        title: block.title || "Indisponible",
        description: block.notes || "Blocage admin La Maison Verte",
      })
    );

    const requestEvents = (requests || []).map((request) =>
      createEvent({
        uid: `request-${request.id}@lamaisonverte65.fr`,
        start_date: request.start_date,
        end_date: request.end_date,
        title: "Réservation directe - La Maison Verte",
        description: [
          request.guest_first_name,
          request.guest_last_name,
          request.guest_email,
          request.guest_phone,
        ]
          .filter(Boolean)
          .join(" - "),
      })
    );

    const calendar = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//La Maison Verte//Calendrier//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...blockEvents,
      ...requestEvents,
      "END:VCALENDAR",
    ].join("\r\n");

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