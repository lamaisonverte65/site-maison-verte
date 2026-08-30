import { schedule } from "@netlify/functions";
import ical from "node-ical";
import { createClient } from "@supabase/supabase-js";
import { claimMissingAlerts, persistExternalOccupancies } from "./_lib/external-calendar-alerts.js";
import { escapeHtml } from "./_lib/html.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const toDateString = (value) => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function getCurrentExternalOccupancies() {
  const sources = [
    { source: "airbnb", url: process.env.AIRBNB_ICAL_URL },
    { source: "booking", url: process.env.BOOKING_ICAL_URL },
  ].filter((item) => item.url);
  if (!sources.length) throw new Error("Aucune source iCal externe configurée.");
  const uids = new Set();
  const occupations = [];
  const successfulSources = [];
  for (const sourceConfig of sources) {
    try {
      const events = await ical.async.fromURL(sourceConfig.url);
      successfulSources.push(sourceConfig.source);
      for (const key in events) {
        const event = events[key];
        if (event.type !== "VEVENT" || !event.uid) continue;
        const startDate = toDateString(event.start);
        const endDate = toDateString(event.end);
        if (!startDate || !endDate || endDate <= startDate) continue;
        uids.add(`${sourceConfig.source}\u0000${event.uid}`);
        occupations.push({
          source: sourceConfig.source,
          external_uid: event.uid,
          start_date: startDate,
          end_date: endDate,
        });
      }
    } catch (error) {
      console.error("Erreur lecture ICS alerte:", error.message);
    }
  }
  if (!successfulSources.length) throw new Error("Toutes les sources iCal externes sont indisponibles.");
  return { uids, occupations, successfulSources };
}

const occupancyRepository = {
  async upsertOccupancies(rows) {
    const { error } = await supabase.from("external_occupancies")
      .upsert(rows, { onConflict: "source,external_uid" });
    if (error) throw error;
  },
  async retireUnseenOccupancies(source, seenAt) {
    const { error } = await supabase.from("external_occupancies")
      .update({ is_current: false, updated_at: seenAt })
      .eq("source", source)
      .eq("is_current", true)
      .lt("last_seen_at", seenAt);
    if (error) throw error;
  },
};

function alertRepository() {
  return {
    async claim(action) {
      if (!action?.id) return false;
      const { data, error } = await supabase
        .from("external_calendar_actions")
        .update({ alert_status: "missing_claimed", updated_at: new Date().toISOString() })
        .eq("id", action.id)
        .or("alert_status.is.null,and(alert_status.neq.missing_claimed,alert_status.neq.missing_alerted)")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data?.id);
    },
    async markSent(actions) {
      if (!actions.length) return;
      const { error } = await supabase
        .from("external_calendar_actions")
        .update({ alert_status: "missing_alerted", alert_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .in("id", actions.map((action) => action.id))
        .eq("alert_status", "missing_claimed");
      if (error) throw error;
    },
    async release(actions) {
      if (!actions.length) return;
      const { error } = await supabase
        .from("external_calendar_actions")
        .update({ alert_status: "missing_retry", updated_at: new Date().toISOString() })
        .in("id", actions.map((action) => action.id))
        .eq("alert_status", "missing_claimed");
      if (error) console.error("Impossible de libérer les alertes calendrier:", error.message);
    },
  };
}

async function sendAlertEmail(actions) {
  const to = String(process.env.EXTERNAL_CALENDAR_ALERT_EMAIL || "lamaisonverte65@gmail.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Destinataire d'alerte calendrier invalide.");
  const items = actions.map((action) => `<li><strong>${escapeHtml(action.source)}</strong> · ${escapeHtml(action.start_date || "?")} → ${escapeHtml(action.end_date || "?")} · UID ${escapeHtml(action.uid)}</li>`).join("");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "La Maison Verte <contact@lamaisonverte65.fr>",
      to: [to],
      subject: "Alerte réservation externe disparue de l'ICS",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Alerte calendrier externe — La Maison Verte</h2><p>Une ou plusieurs réservations Booking/Airbnb ne sont plus présentes dans l'ICS.</p><ul>${items}</ul></div>`,
    }),
  });
  if (!response.ok) throw new Error("Envoi de l'alerte calendrier refusé.");
}

export async function runExternalCalendarAlerts() {
  const current = await getCurrentExternalOccupancies();
  await persistExternalOccupancies(
    occupancyRepository,
    current.occupations,
    new Date().toISOString(),
    current.successfulSources,
  );
  const { data: actions, error } = await supabase
    .from("external_calendar_actions")
    .select("*")
    .eq("is_active", true)
    .in("action", ["convert", "split"]);
  if (error) throw error;
  const missing = (actions || []).filter((action) => (
    action.uid
    && !current.uids.has(`${action.source}\u0000${action.uid}`)
    && action.alert_status !== "missing_alerted"
  ));
  const repository = alertRepository();
  const claimed = await claimMissingAlerts(repository, missing);
  if (claimed.length) {
    try {
      await sendAlertEmail(claimed);
      await repository.markSent(claimed);
    } catch (error) {
      await repository.release(claimed);
      throw error;
    }
  }
  return { success: true, checked: (actions || []).length, missing: claimed.length };
}

export const handler = schedule("30 7 * * *", async () => {
  try {
    return { statusCode: 200, body: JSON.stringify(await runExternalCalendarAlerts()) };
  } catch (error) {
    console.error("Erreur check-external-calendar-alerts:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Vérification calendrier impossible." }) };
  }
});
