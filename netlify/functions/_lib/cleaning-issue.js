const ACTIONS = new Set(["report", "confirm", "cancel"]);
const TRANSITIONS = new Map([
  ["reported", new Set(["confirmed", "cancelled"])],
  ["confirmed", new Set(["payment_requested", "cancelled"])],
  ["payment_requested", new Set(["paid", "confirmed", "cancelled"])],
  ["paid", new Set()],
  ["cancelled", new Set()],
]);

const fail = (error, statusCode = 400) => ({ ok: false, statusCode, error });

export function canTransitionCleaningIssue(fromStatus, toStatus) {
  return TRANSITIONS.get(String(fromStatus || ""))?.has(String(toStatus || "")) === true;
}

export function validateCleaningIssueAction(input = {}) {
  const allowedFields = new Set(["action", "bookingId", "note"]);
  const unknown = Object.keys(input).find((key) => !allowedFields.has(key));
  if (unknown) return fail(`Attribut non autorisé : ${unknown}.`);
  const action = String(input.action || "").trim();
  const bookingId = String(input.bookingId || "").trim();
  if (!ACTIONS.has(action)) return fail("Action ménage invalide.");
  if (!bookingId) return fail("Réservation obligatoire.");
  if (action === "report") {
    const note = String(input.note || "").trim();
    if (!note || note.length > 2000) return fail("Note de signalement obligatoire et limitée à 2000 caractères.");
    return { ok: true, value: { action, bookingId, note } };
  }
  if (Object.hasOwn(input, "note")) return fail("La note n'est autorisée que pour un signalement.");
  return { ok: true, value: { action, bookingId } };
}

export function buildCleaningIssueFromBooking(booking = {}, { note, reportedBy = null } = {}) {
  const bookingId = String(booking.id || "").trim();
  if (!bookingId) throw new Error("booking_required");
  const snapshot = Number(booking.cleaning_fee);
  const amount = Number.isFinite(snapshot) && snapshot > 0 ? snapshot : 0;
  const normalizedNote = String(note || "").trim();
  if (!normalizedNote || normalizedNote.length > 2000) throw new Error("cleaning_issue_note_invalid");
  return {
    booking_request_id: bookingId,
    reported_by: reportedBy ? String(reportedBy) : null,
    status: "reported",
    amount_due: amount,
    notes: normalizedNote,
  };
}
