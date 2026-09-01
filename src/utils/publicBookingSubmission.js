const failure = (kind, message) => ({
  kind,
  success: false,
  clearForm: false,
  reload: false,
  message,
});

const PUBLIC_BOOKING_TIMEOUT_MS = 15_000;

export async function submitPublicBooking(payload, {
  fetchImpl = fetch,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeoutImpl(() => {
    timedOut = true;
    controller.abort();
  }, PUBLIC_BOOKING_TIMEOUT_MS);

  try {
    const response = await fetchImpl("/api/booking-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok && body?.success === true && typeof body.bookingId === "string" && body.bookingId) {
      const confirmationPending = body.confirmationPending === true;
      return {
        kind: confirmationPending ? "recorded_confirmation_pending" : "success",
        success: true,
        clearForm: true,
        reload: true,
        bookingId: body.bookingId,
        ...(confirmationPending ? { confirmationPending: true } : {}),
      };
    }
    if (response.status === 400) return failure("validation", "Certaines informations sont invalides. Vérifiez le formulaire puis réessayez.");
    if (response.status === 409 && body?.code === "DATE_CONFLICT") {
      return {
        ...failure("date_conflict", "Une réservation vient d’être enregistrée sur tout ou partie de ces dates. Merci de choisir d’autres dates."),
        resetDates: true,
        refreshCalendar: true,
      };
    }
    if (response.status === 409) return failure("duplicate", "Cette demande semble avoir déjà été envoyée. Aucun nouvel envoi n’a été créé.");
    if (response.status === 429) return failure("rate_limit", "Trop de tentatives ont été effectuées. Patientez quelques minutes avant de réessayer.");
    return failure("server_error", "Nous n’avons pas pu confirmer l’enregistrement de votre demande. Vos informations sont conservées ; réessayez ou contactez-nous.");
  } catch (error) {
    if (timedOut || error?.name === "AbortError") {
      return failure("timeout", "La demande prend plus de temps que prévu. Vos informations sont conservées ; vous pouvez réessayer.");
    }
    return failure("network_error", "Connexion impossible. Vos informations sont conservées ; vérifiez votre connexion puis réessayez.");
  } finally {
    clearTimeoutImpl(timeout);
  }
}
