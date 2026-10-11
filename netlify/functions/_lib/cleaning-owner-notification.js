import { escapeHtml } from "./html.js";
import { resendEmail } from "./resend-email.js";

const dateFr = (value) => value ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" }).format(new Date(`${String(value).slice(0,10)}T12:00:00Z`)) : "—";

export function buildCleaningOwnerNotification({ booking, issue, reporterName = null }) {
  const ownerEmail = String(process.env.BOOKING_NOTIFICATION_EMAIL || "lamaisonverte65@gmail.com").trim().toLowerCase();
  const guestName = [booking?.guest_first_name, booking?.guest_last_name].filter(Boolean).join(" ").trim() || "Client";
  const adminUrl = `https://lamaisonverte65.fr/admin?reservation=${encodeURIComponent(booking.id)}`;
  const subject = `Signalement ménage à traiter — ${guestName}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6">
    <h2>Signalement ménage à traiter</h2>
    <p><strong>Client :</strong> ${escapeHtml(guestName)}<br>
    <strong>Séjour :</strong> ${escapeHtml(dateFr(booking.start_date))} → ${escapeHtml(dateFr(booking.end_date))}<br>
    <strong>Signalé par :</strong> ${escapeHtml(reporterName || "Équipe ménage")}<br>
    <strong>Statut :</strong> Signalé</p>
    <p><strong>Constat :</strong><br>${escapeHtml(issue?.notes || "").replace(/\r?\n/g, "<br>")}</p>
    <p style="margin-top:28px"><a href="${escapeHtml(adminUrl)}" style="background:#166534;color:white;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">Ouvrir la réservation dans l'admin</a></p>
  </div>`;
  return { ownerEmail, subject, html, adminUrl };
}

export async function sendCleaningOwnerNotification({ booking, issue, reporterName = null, supabase }) {
  const email = buildCleaningOwnerNotification({ booking, issue, reporterName });
  const retryPayload = {
    from: "La Maison Verte <contact@lamaisonverte65.fr>",
    to: [email.ownerEmail],
    reply_to: "contact@lamaisonverte65.fr",
    subject: email.subject,
    html: email.html,
  };
  const response = await resendEmail(retryPayload);
  let providerId = null;
  let errorMessage = null;
  if (response.ok) {
    try { providerId = (await response.json())?.id || null; } catch (_) {}
  } else {
    errorMessage = await response.text();
  }
  if (supabase) {
    const { error } = await supabase.from("email_logs").insert([{
      booking_request_id: booking.id,
      email_type: "cleaning_issue_owner_alert",
      to_email: email.ownerEmail,
      subject: email.subject,
      status: response.ok ? "sent" : "error",
      error_message: errorMessage,
      provider_id: providerId,
      retry_payload: response.ok ? null : retryPayload,
      sent_at: new Date().toISOString(),
    }]);
    if (error) console.error("Erreur log alerte ménage owner:", error.message);
  }
  return { sent: response.ok, error: errorMessage, adminUrl: email.adminUrl };
}
