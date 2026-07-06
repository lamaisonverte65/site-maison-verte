import ical from "node-ical";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

async function getCurrentExternalUids() {
  const sources = [process.env.AIRBNB_ICAL_URL, process.env.BOOKING_ICAL_URL].filter(Boolean);
  const uids = new Set();

  for (const url of sources) {
    try {
      const events = await ical.async.fromURL(url);
      for (const key in events) {
        const event = events[key];
        if (event.type === "VEVENT" && event.uid) uids.add(event.uid);
      }
    } catch (error) {
      console.error("Erreur lecture ICS alerte:", error.message);
    }
  }

  return uids;
}

async function sendAlertEmail(missingActions) {
  const to = process.env.EXTERNAL_CALENDAR_ALERT_EMAIL || "lamaisonverte65@gmail.com";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">
      <h2>Alerte calendrier externe — La Maison Verte</h2>
      <p>Une ou plusieurs réservations créées depuis Booking/Airbnb ne sont plus présentes dans l'ICS.</p>
      <p>Il faut vérifier s'il s'agit d'une annulation ou d'un changement côté plateforme.</p>
      <ul>
        ${missingActions.map((action) => `<li><strong>${action.source}</strong> · ${action.start_date || "?"} → ${action.end_date || "?"} · UID ${action.uid}</li>`).join("")}
      </ul>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [to],
      subject: "Alerte réservation externe disparue de l'ICS",
      html,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
}

export async function handler() {
  try {
    const currentUids = await getCurrentExternalUids();

    const { data: actions, error } = await supabase
      .from("external_calendar_actions")
      .select("*")
      .eq("is_active", true)
      .in("action", ["convert", "split"]);

    if (error) throw error;

    const missing = (actions || []).filter((action) => action.uid && !currentUids.has(action.uid) && action.alert_status !== "missing_alerted");

    if (missing.length > 0) {
      await sendAlertEmail(missing);
      await supabase
        .from("external_calendar_actions")
        .update({ alert_status: "missing_alerted", alert_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in("uid", missing.map((action) => action.uid));
    }

    return json(200, { success: true, checked: (actions || []).length, missing: missing.length });
  } catch (error) {
    console.error("Erreur check-external-calendar-alerts:", error);
    return json(500, { error: error.message });
  }
}
