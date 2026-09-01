import { createPublicBookingFingerprint } from "./public-booking.js";

const ATOMIC_OUTCOMES = new Set(["created", "duplicate", "date_conflict"]);

export const DATE_CONFLICT_MESSAGE = "Une réservation vient d’être enregistrée sur tout ou partie de ces dates. Merci de choisir d’autres dates.";

export function isBookingDateConflictError(error) {
  return error?.code === "23P01";
}

export function normalizeAtomicBookingResult(data) {
  const row = Array.isArray(data) ? data[0] : data;
  const outcome = String(row?.outcome || "");
  const bookingId = row?.booking_id || row?.bookingId || null;

  if (!ATOMIC_OUTCOMES.has(outcome) || (outcome === "created" && !bookingId)) {
    throw new Error("Résultat de création atomique invalide.");
  }

  return { outcome, bookingId };
}

export function createSupabaseAtomicBookingRepository(supabase) {
  return {
    async createAtomic({ booking, fingerprint, now }) {
      const { data, error } = await supabase.rpc("create_public_booking_request_atomic", {
        p_booking: booking,
        p_fingerprint: fingerprint,
        p_now: now,
      });
      if (error) throw error;
      return normalizeAtomicBookingResult(data);
    },
  };
}

export async function runAtomicPublicBookingWorkflow({
  validated,
  repository,
  buildEmails,
  deliverEmail,
  onEmailError = (error) => console.error("Erreur confirmation demande publique:", error),
  now = new Date(),
}) {
  const creation = normalizeAtomicBookingResult(await repository.createAtomic({
    booking: validated.booking,
    fingerprint: createPublicBookingFingerprint(validated.booking),
    now: now.toISOString(),
  }));

  if (creation.outcome !== "created") return creation;

  try {
    const emails = buildEmails(validated.emailModel);
    await deliverEmail(emails.owner, creation.bookingId, "booking_request:owner");
    await deliverEmail(emails.guest, creation.bookingId, "booking_request:guest");
    return creation;
  } catch (error) {
    onEmailError(error);
    return { ...creation, confirmationPending: true };
  }
}
