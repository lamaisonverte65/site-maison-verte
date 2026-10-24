// Changement exclusivement linguistique d'une réservation par le propriétaire.
// Les autres champs de la réservation ne peuvent pas être transmis à cet endpoint.
const LANGUAGES = new Set(["fr", "en", "es"]);
const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBookingLanguageChange(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Demande de modification invalide." };
  }
  const keys = Object.keys(body);
  if (keys.length !== 2 || !keys.includes("bookingId") || !keys.includes("communicationLanguage")) {
    return { ok: false, error: "Seuls l'identifiant et la langue sont acceptés." };
  }
  if (typeof body.bookingId !== "string" || !BOOKING_ID.test(body.bookingId)) {
    return { ok: false, error: "Identifiant de réservation invalide." };
  }
  if (typeof body.communicationLanguage !== "string" || !LANGUAGES.has(body.communicationLanguage)) {
    return { ok: false, error: "Langue non prise en charge." };
  }
  return { ok: true, bookingId: body.bookingId, communicationLanguage: body.communicationLanguage };
}
