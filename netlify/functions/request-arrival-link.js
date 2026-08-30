import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { recoverArrivalLink } from "./_lib/arrival-link-recovery.js";
import { escapeHtml } from "./_lib/html.js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SITE_URL = process.env.URL || "https://lamaisonverte65.fr";

export const config = { background: true };

const opaqueKey = (scope, value) => createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "")
  .update(`${scope}:${String(value || "")}`, "utf8")
  .digest("hex");

async function claimPublicLimit({ scope, key, windowSeconds, limit, now }) {
  const { data, error } = await supabase.rpc("claim_public_rate_limit", {
    p_scope: scope,
    p_key_hash: key,
    p_window_seconds: windowSeconds,
    p_limit: limit,
    p_now: now,
  });
  return !error && data === true;
}

const repository = {
  claimIpAttempt({ ipKey, now }) {
    return claimPublicLimit({
      scope: "arrival_recovery_ip",
      key: opaqueKey("ip", ipKey),
      windowSeconds: 3600,
      limit: 3,
      now,
    });
  },
  claimBookingAttempt({ bookingKey, now }) {
    return claimPublicLimit({
      scope: "arrival_recovery_booking",
      key: opaqueKey("booking", bookingKey),
      windowSeconds: 900,
      limit: 1,
      now,
    });
  },
  async findBookingById(bookingId) {
    const { data, error } = await supabase
      .from("booking_requests")
      .select("id,status,start_date,end_date,guest_email,guest_first_name,guest_last_name,arrival_time,arrival_token_hash,arrival_token_expires_at,arrival_token_created_at")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async hasRecentRecovery(bookingId, since) {
    const { data, error } = await supabase
      .from("email_logs")
      .select("id")
      .eq("booking_request_id", bookingId)
      .eq("email_type", "arrival_link_reissue")
      .eq("status", "sent")
      .gte("sent_at", since)
      .limit(1);
    if (error) throw error;
    return Boolean(data?.length);
  },
  async saveToken({ bookingId, hash, expiresAt, createdAt, notAfter }) {
    const { data, error } = await supabase.from("booking_requests").update({
      arrival_token_hash: hash,
      arrival_token_expires_at: expiresAt,
      arrival_token_created_at: createdAt,
      updated_at: createdAt,
    })
      .eq("id", bookingId)
      .or(`arrival_token_created_at.is.null,arrival_token_created_at.lt.${notAfter}`)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.id);
  },
  async restoreToken(value) {
    const { error } = await supabase.from("booking_requests").update({
      arrival_token_hash: value.arrival_token_hash,
      arrival_token_expires_at: value.arrival_token_expires_at,
      arrival_token_created_at: value.arrival_token_created_at,
      updated_at: new Date().toISOString(),
    }).eq("id", value.bookingId).eq("arrival_token_hash", value.expectedHash);
    if (error) throw error;
  },
  async appendEmailLog(value) {
    const { error } = await supabase.from("email_logs").insert([{
      booking_request_id: value.bookingId,
      email_type: value.emailType,
      to_email: value.toEmail,
      subject: "Nouveau lien sécurisé pour votre heure d’arrivée",
      status: value.status,
      provider_id: value.providerId,
      error_message: value.status === "error" ? "Envoi du lien sécurisé impossible." : null,
      sent_at: new Date().toISOString(),
      metadata: { tokenExpiresAt: value.tokenExpiresAt },
    }]);
    if (error) throw error;
  },
};

const mailer = {
  async sendArrivalLink({ to, url, booking }) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "La Maison Verte <contact@lamaisonverte65.fr>",
        to: [to],
        reply_to: "contact@lamaisonverte65.fr",
        subject: "Nouveau lien sécurisé pour votre heure d’arrivée",
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Votre heure d’arrivée</h2><p>Bonjour ${escapeHtml(booking.guest_first_name)} ${escapeHtml(booking.guest_last_name)},</p><p>Voici votre nouveau lien sécurisé pour indiquer votre heure d’arrivée à La Maison Verte.</p><p><a href="${escapeHtml(url)}" style="background:#16a34a;color:white;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">Renseigner mon heure d’arrivée</a></p><p>Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.</p></div>`,
      }),
    });
    if (!response.ok) throw new Error("Recovery email delivery failed.");
    const data = await response.json().catch(() => null);
    return { providerId: data?.id || null };
  },
};

export default async function handler(request, context) {
  if (request.method !== "POST") return;
  let input = {};
  try { input = await request.json(); } catch (_) {}
  await recoverArrivalLink(input, {
    repository,
    mailer,
    siteUrl: SITE_URL,
    rateLimitKey: context?.ip || "",
  });
}
