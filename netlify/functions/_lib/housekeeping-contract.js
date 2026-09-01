import { isTechnicalExternalOneNight } from "./external-calendar-rules.js";

const NOTE_INPUT_FIELDS = new Set(["reservationId", "note"]);

const fail = (error) => ({ ok: false, statusCode: 400, error });

const textOrNull = (value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

export function parseHousekeepingReservationTarget(value) {
  const id = String(value || "").trim();
  if (!id.startsWith("external:")) return { kind: "booking", id };
  const [, source, ...uidParts] = id.split(":");
  const uid = uidParts.join(":").trim();
  if (!["airbnb", "booking"].includes(source) || !uid) {
    return fail("Identifiant de réservation externe invalide.");
  }
  return { kind: "external", source, uid };
}

const externalKey = (source, uid) => `${source || ""}\u0000${uid || ""}`;

export function filterVisibleExternalOccupations(occupations = [], actions = []) {
  const resolvedTargets = new Set(
    actions
      .filter((action) => (
        action?.is_active === true
        && action?.status === "applied"
        && (
          (Array.isArray(action.created_booking_ids) && action.created_booking_ids.length > 0)
          || (Array.isArray(action.created_block_ids) && action.created_block_ids.length > 0)
        )
      ))
      .map((action) => externalKey(action.source, action.uid)),
  );
  return occupations.filter((occupation) => (
    occupation?.is_current === true
    && !isTechnicalExternalOneNight(
      occupation.source,
      occupation.start_date,
      occupation.end_date,
    )
    && !resolvedTargets.has(externalKey(occupation.source, occupation.external_uid))
  ));
}

function toHousekeepingNote(row = {}) {
  return {
    id: String(row.id || ""),
    note: textOrNull(row.note),
    authorAdminUserId: textOrNull(row.author_admin_user_id),
    authorDisplayName: textOrNull(row.author_display_name),
    createdAt: textOrNull(row.created_at),
  };
}

export function toHousekeepingReservation(row = {}, notes = []) {
  return {
    id: String(row.id || ""),
    source: textOrNull(row.source) || "direct",
    startDate: textOrNull(row.start_date),
    endDate: textOrNull(row.end_date),
    guest: {
      firstName: textOrNull(row.guest_first_name),
      lastName: textOrNull(row.guest_last_name),
      phone: textOrNull(row.guest_phone),
      email: textOrNull(row.guest_email),
    },
    occupancy: {
      adults: row.adults_count ?? null,
      children: row.children_count ?? null,
      childrenAges: textOrNull(row.children_ages),
      babyBedNeeded: row.baby_bed_needed ?? null,
    },
    stay: {
      arrivalTime: textOrNull(row.arrival_time),
      departureTime: textOrNull(row.departure_time),
      practicalInformation: textOrNull(row.practical_information),
    },
    communications: {
      clientMessage: textOrNull(row.message),
    },
    internalNotes: {
      ownerForHousekeeping: textOrNull(row.housekeeping_notes),
      housekeeping: (notes || []).map(toHousekeepingNote),
    },
  };
}

export function toHousekeepingExternalReservation(occupation = {}, linked = {}, notes = []) {
  const uid = textOrNull(occupation.external_uid || occupation.uid);
  return toHousekeepingReservation({
    id: `external:${textOrNull(occupation.source) || "external"}:${uid || "unknown"}`,
    source: occupation.source || "external",
    start_date: occupation.start_date,
    end_date: occupation.end_date,
    guest_first_name: linked.guest_first_name,
    guest_last_name: linked.guest_last_name,
    guest_phone: linked.guest_phone,
    guest_email: linked.guest_email,
    adults_count: linked.adults_count,
    children_count: linked.children_count,
    children_ages: linked.children_ages,
    baby_bed_needed: linked.baby_bed_needed,
    arrival_time: linked.arrival_time,
    departure_time: linked.departure_time,
    practical_information: linked.practical_information,
    housekeeping_notes: linked.housekeeping_notes,
  }, notes);
}

export function validateHousekeepingNoteInput(input = {}) {
  const unknown = Object.keys(input).find((field) => !NOTE_INPUT_FIELDS.has(field));
  if (unknown) return fail(`Attribut non autorisé : ${unknown}.`);
  if (Object.keys(input).length !== 2) return fail("Note ménage incomplète.");

  const reservationId = String(input.reservationId || "").trim();
  const note = String(input.note || "").trim();
  if (!reservationId) return fail("Réservation obligatoire.");
  if (!note || note.length > 2000) return fail("Note ménage invalide.");
  return { ok: true, value: { reservationId, note } };
}

export function validateHousekeepingReadRequest(input = {}) {
  if (Object.keys(input).length === 1 && input.action === "list") return { ok: true };
  return fail("Le contrat ménage est strictement en lecture seule.");
}
