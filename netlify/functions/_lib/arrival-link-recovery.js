import { createHash, timingSafeEqual } from "node:crypto";
import { createArrivalToken } from "./arrival-token.js";
import { normalizeEmail } from "./normalize.js";

const ELIGIBLE_STATUSES = new Set(["deposit_paid", "paid", "fully_paid", "confirmed"]);
const PUBLIC_MESSAGE = "Si les informations correspondent, un nouveau lien sécurisé sera envoyé à l’adresse enregistrée.";
const ALLOWED_FIELDS = new Set(["bookingId", "email", "lastName", "website"]);

const publicResult = () => ({ statusCode: 202, body: { accepted: true, message: PUBLIC_MESSAGE } });
const digest = (value) => createHash("sha256").update(String(value), "utf8").digest();
const normalizeName = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("fr-FR").replace(/\s+/g, " ");

function safeTextEquals(left, right) {
  return timingSafeEqual(digest(left), digest(right));
}

function normalizeRecoveryInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (Object.keys(input).some((field) => !ALLOWED_FIELDS.has(field))) return null;
  const bookingId = String(input.bookingId ?? "").trim();
  const email = normalizeEmail(input.email);
  const lastName = normalizeName(input.lastName);
  if (String(input.website ?? "").trim()) return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(bookingId)) return null;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!lastName || lastName.length > 100) return null;
  return { bookingId, email, lastName };
}

function isEligibleBooking(booking, now) {
  return Boolean(
    booking?.id
      && !booking.arrival_time
      && ELIGIBLE_STATUSES.has(String(booking.status || ""))
      && /^\d{4}-\d{2}-\d{2}$/.test(String(booking.end_date || ""))
      && now.toISOString().slice(0, 10) <= booking.end_date,
  );
}

function identityMatches(booking, input) {
  return safeTextEquals(normalizeEmail(booking?.guest_email), input.email)
    && safeTextEquals(normalizeName(booking?.guest_last_name), input.lastName);
}

export async function recoverArrivalLink(input, {
  repository,
  mailer,
  siteUrl,
  rateLimitKey,
  now = new Date(),
  randomBytes,
  logger = console,
}) {
  const normalized = normalizeRecoveryInput(input);
  if (!normalized) return publicResult();

  let booking = null;
  let capability = null;
  let tokenSaved = false;
  let delivered = false;
  try {
    if (!rateLimitKey || !await repository.claimIpAttempt({
      ipKey: rateLimitKey,
      now: now.toISOString(),
    })) return publicResult();

    booking = await repository.findBookingById(normalized.bookingId);
    if (!isEligibleBooking(booking, now) || !identityMatches(booking, normalized)) return publicResult();

    if (!await repository.claimBookingAttempt({
      bookingKey: booking.id,
      now: now.toISOString(),
    })) return publicResult();

    const cooldownSince = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    if (await repository.hasRecentRecovery(booking.id, cooldownSince)) return publicResult();

    capability = createArrivalToken(booking, { randomBytes });
    const claimed = await repository.saveToken({
      bookingId: booking.id,
      hash: capability.hash,
      expiresAt: capability.expiresAt,
      createdAt: now.toISOString(),
      notAfter: cooldownSince,
    });
    if (!claimed) return publicResult();
    tokenSaved = true;

    const url = `${String(siteUrl || "").replace(/\/$/, "")}/arrival?booking=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(capability.token)}`;
    const delivery = await mailer.sendArrivalLink({ to: booking.guest_email, url, booking });
    delivered = true;
    await repository.appendEmailLog({
      bookingId: booking.id,
      emailType: "arrival_link_reissue",
      toEmail: booking.guest_email,
      status: "sent",
      providerId: delivery?.providerId || null,
      tokenExpiresAt: capability.expiresAt,
    });
  } catch (error) {
    logger.error("Arrival-link recovery failed.", error);
    if (tokenSaved && !delivered && booking && capability) {
      try {
        await repository.restoreToken({
          bookingId: booking.id,
          expectedHash: capability.hash,
          arrival_token_hash: booking.arrival_token_hash || null,
          arrival_token_expires_at: booking.arrival_token_expires_at || null,
          arrival_token_created_at: booking.arrival_token_created_at || null,
        });
      } catch (restoreError) {
        logger.error("Arrival-link token restore failed.", restoreError);
      }
    }
    if (!delivered && booking?.id) {
      try {
        await repository.appendEmailLog({
          bookingId: booking.id,
          emailType: "arrival_link_reissue",
          toEmail: booking.guest_email || null,
          status: "error",
          providerId: null,
          tokenExpiresAt: capability?.expiresAt || null,
        });
      } catch (logError) {
        logger.error("Arrival-link recovery log failed.", logError);
      }
    }
  }
  return publicResult();
}
