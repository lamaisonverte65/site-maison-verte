const CATEGORIES = new Set(["cleaning", "damage", "extra_bed", "other"]);
const TRANSITIONS = new Map([
  ["draft", new Set(["payment_requested", "cancelled"])],
  ["payment_requested", new Set(["payment_requested", "paid", "cancelled"])],
  ["paid", new Set()],
  ["cancelled", new Set()],
]);

const clean = (value) => String(value ?? "").trim();

export function canTransitionAdditionalCharge(from, to) {
  return Boolean(TRANSITIONS.get(String(from || ""))?.has(String(to || "")));
}

export function validateAdditionalChargeCreate(input = {}) {
  const bookingId = clean(input.bookingId);
  const reasonLabel = clean(input.reasonLabel);
  const category = CATEGORIES.has(clean(input.category)) ? clean(input.category) : "other";
  const amount = Number(String(input.amount ?? "").replace(",", "."));
  const customerMessage = clean(input.customerMessage);
  const cleaningIssueId = clean(input.cleaningIssueId) || null;

  if (!bookingId) return { ok: false, statusCode: 400, error: "bookingId obligatoire." };
  if (!reasonLabel || reasonLabel.length > 200) return { ok: false, statusCode: 400, error: "Motif obligatoire (200 caractères maximum)." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, statusCode: 400, error: "Montant complémentaire invalide." };
  if (customerMessage.length > 3000) return { ok: false, statusCode: 400, error: "Message client trop long." };

  return {
    ok: true,
    value: { bookingId, category, reasonLabel, amount: Math.round(amount * 100) / 100, customerMessage, cleaningIssueId },
  };
}
