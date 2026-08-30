export function getArrivalLinkMode({ bookingId, token }) {
  if (!bookingId) return "invalid";
  return /^[a-f0-9]{64}$/.test(String(token || "")) ? "secure" : "recovery";
}
