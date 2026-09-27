import crypto from "crypto";

function getSecret() {
  const secret = process.env.BALANCE_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("BALANCE_LINK_SECRET ou SUPABASE_SERVICE_ROLE_KEY manquant.");
  return secret;
}

export function createBalanceToken(bookingId) {
  return crypto.createHmac("sha256", getSecret()).update(`balance:${bookingId}`).digest("hex");
}

export function verifyBalanceToken(bookingId, token) {
  const expected = createBalanceToken(bookingId);
  const supplied = String(token || "");
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function createBalancePaymentUrl(siteUrl, bookingId) {
  const token = createBalanceToken(bookingId);
  return `${siteUrl}/.netlify/functions/pay-balance?booking=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}`;
}
