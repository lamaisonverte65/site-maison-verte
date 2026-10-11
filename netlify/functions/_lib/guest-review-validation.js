import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSecret(explicitSecret) {
  const secret = explicitSecret || process.env.REVIEW_VALIDATION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) throw new Error("Secret de validation des avis non configuré.");
  return secret;
}

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function validateGuestReviewPayload(input = {}) {
  const firstName = String(input.firstName ?? input.guest_first_name ?? "").trim();
  const lastName = String(input.lastName ?? input.guest_last_name ?? "").trim();
  const email = String(input.email ?? input.guest_email ?? "").trim();
  const phone = String(input.phone ?? input.guest_phone ?? "").trim();
  const stayPeriod = String(input.stayPeriod ?? input.stay_period ?? "").trim();
  const comment = String(input.comment ?? "").trim();
  const rating = Number(input.rating);

  if (!firstName) return { ok: false, statusCode: 400, error: "Merci d’indiquer votre prénom." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, statusCode: 400, error: "La note doit être comprise entre 1 et 5." };
  if (comment.length < 5) return { ok: false, statusCode: 400, error: "Le commentaire doit contenir au moins 5 caractères." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, statusCode: 400, error: "Adresse email invalide." };

  return {
    ok: true,
    review: {
      guest_first_name: firstName,
      guest_last_name: lastName || null,
      guest_email: email || null,
      guest_phone: phone || null,
      rating,
      comment,
      stay_period: stayPeriod || null,
      display_name: firstName,
      consent_to_publish: true,
      source: "website",
      status: "pending",
    },
  };
}

export function createGuestReviewValidationToken(reviewId, { secret, nowMs = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  if (!reviewId) throw new Error("Identifiant d’avis manquant.");
  const payload = b64url(JSON.stringify({ reviewId: String(reviewId), exp: Math.floor(nowMs / 1000) + ttlSeconds }));
  return `${payload}.${sign(payload, getSecret(secret))}`;
}

export function verifyGuestReviewValidationToken(token, { secret, nowMs = Date.now() } = {}) {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) throw new Error("Token invalide.");
  const expected = sign(payload, getSecret(secret));
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) throw new Error("Token invalide.");

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Token invalide.");
  }
  if (!decoded?.reviewId || !Number.isFinite(decoded?.exp)) throw new Error("Token invalide.");
  if (Math.floor(nowMs / 1000) > decoded.exp) throw new Error("Token expiré.");
  return { reviewId: String(decoded.reviewId) };
}

export function buildGuestReviewOwnerEmail(review, validationUrl, ownerEmail) {
  const displayName = review.display_name || review.guest_first_name || "Voyageur";
  const stars = "★".repeat(Math.max(0, Math.min(5, Number(review.rating || 0))));
  const safeComment = escapeHtml(review.comment).replaceAll("\n", "<br>");
  const safeUrl = escapeHtml(validationUrl);
  return {
    to: ownerEmail,
    subject: `Nouvel avis à valider — La Maison Verte — ${displayName}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6;max-width:680px;margin:auto;">
        <h2 style="color:#14532d;">Nouvel avis à valider</h2>
        <p><strong>${escapeHtml(displayName)}</strong> a laissé un avis sur La Maison Verte.</p>
        <p style="font-size:22px;color:#d97706;">${stars} <span style="font-size:16px;color:#374151;">${Number(review.rating || 0)}/5</span></p>
        ${review.stay_period ? `<p><strong>Séjour :</strong> ${escapeHtml(review.stay_period)}</p>` : ""}
        <div style="background:#f8fafc;border-radius:16px;padding:18px;margin:20px 0;">${safeComment}</div>
        <p style="margin:28px 0;"><a href="${safeUrl}" style="display:inline-block;background:#1f6f3d;color:white;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:bold;">Voir et valider l’avis</a></p>
        <p><a href="${escapeHtml((process.env.URL || "https://lamaisonverte65.fr") + "/admin")}" style="color:#14532d;">Ouvrir l’administration</a></p>
      </div>`,
  };
}
