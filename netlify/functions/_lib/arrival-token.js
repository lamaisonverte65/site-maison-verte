import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const eligibleStatuses = new Set(["deposit_paid", "paid", "fully_paid", "confirmed"]);
const fail = (error, statusCode = 403) => ({ ok: false, statusCode, error });

export function hashArrivalToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

export function createArrivalToken(booking, { secret = process.env.ARRIVAL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY } = {}) {
  if (!booking?.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(booking.end_date || ""))) throw new Error("Réservation incompatible avec un jeton d'arrivée.");
  if (!secret) throw new Error("Secret de lien d'arrivée indisponible.");
  const token = createHmac("sha256", secret)
    .update(`arrival:${booking.id}`, "utf8")
    .digest("hex");
  return {
    token,
    hash: hashArrivalToken(token),
    expiresAt: `${booking.end_date}T23:59:59.999Z`,
  };
}

export function hasUsableArrivalToken(booking, { now = new Date() } = {}) {
  const hash = String(booking?.arrival_token_hash || "");
  const expiresAt = new Date(booking?.arrival_token_expires_at || "");
  return /^[a-f0-9]{64}$/.test(hash)
    && !Number.isNaN(expiresAt.getTime())
    && expiresAt.getTime() > now.getTime();
}

export function shouldSendSecureArrivalReminder(_booking, { reminderSent = false } = {}) {
  return !reminderSent;
}

function safeHashEquals(expected, actual) {
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
}

export function verifyArrivalAccess({ booking, bookingId, token, now = new Date() }) {
  if (!booking || !bookingId || booking.id !== bookingId) return fail("Réservation invalide.");
  if (!/^[a-f0-9]{64}$/.test(String(token || ""))) return fail("Jeton d'arrivée requis.");
  if (!safeHashEquals(String(booking.arrival_token_hash || ""), hashArrivalToken(token))) return fail("Jeton d'arrivée invalide.");

  const expiresAt = new Date(booking.arrival_token_expires_at || "");
  if (Number.isNaN(expiresAt.getTime()) || now.getTime() > expiresAt.getTime()) return fail("Ce lien d'arrivée a expiré.", 410);
  if (!eligibleStatuses.has(String(booking.status || ""))) return fail("Cette réservation ne permet pas cette action.", 409);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(booking.end_date || "")) || now.toISOString().slice(0, 10) > booking.end_date) return fail("Le séjour est terminé.", 410);
  return { ok: true };
}

export function verifyArrivalCapability({ booking, bookingId, token, arrivalTime, now = new Date() }) {
  const access = verifyArrivalAccess({ booking, bookingId, token, now });
  if (!access.ok) return access;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(arrivalTime || ""))) return fail("Heure invalide. Utilisez le format HH:MM.", 400);
  return { ok: true, arrivalTime };
}
