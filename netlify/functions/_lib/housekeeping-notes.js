import { isHousekeepingProfile, isOwnerProfile } from "../../../shared/adminPermissions.js";
import {
  parseHousekeepingReservationTarget,
  validateHousekeepingNoteInput,
} from "./housekeeping-contract.js";

const forbidden = (error = "Accès notes ménage refusé.") => ({ ok: false, statusCode: 403, error });

export const canAccessHousekeepingNotes = (profile) => (
  isOwnerProfile(profile) || isHousekeepingProfile(profile)
);

export async function createHousekeepingNote({ repository, author, input }) {
  if (!canAccessHousekeepingNotes(author) || !author?.id) return forbidden();

  const policy = validateHousekeepingNoteInput(input);
  if (!policy.ok) return policy;
  const target = parseHousekeepingReservationTarget(policy.value.reservationId);
  if (target.ok === false) return target;

  let externalTarget = null;
  if (target.kind === "external") {
    externalTarget = await repository.findExternalTarget(target.source, target.uid);
    if (!externalTarget?.id) {
      return { ok: false, statusCode: 404, error: "Occupation externe locale introuvable." };
    }
  } else if (!await repository.directTargetExists(target.id)) {
    return { ok: false, statusCode: 404, error: "Réservation introuvable." };
  }

  const note = await repository.insertNote({
    booking_request_id: target.kind === "booking" ? target.id : null,
    external_occupation_id: target.kind === "external" ? externalTarget.id : null,
    author_admin_user_id: author.id,
    note: policy.value.note,
  });
  return { ok: true, note };
}

export async function listHousekeepingNotes({ repository, requester, reservationId }) {
  if (!canAccessHousekeepingNotes(requester)) return forbidden();
  const target = parseHousekeepingReservationTarget(reservationId);
  if (target.ok === false || (target.kind === "booking" && !target.id)) {
    return target.ok === false ? target : { ok: false, statusCode: 400, error: "Réservation obligatoire." };
  }
  let resolvedTarget = target;
  if (target.kind === "external") {
    const externalTarget = await repository.findExternalTarget(target.source, target.uid);
    if (!externalTarget?.id) {
      return { ok: false, statusCode: 404, error: "Occupation externe locale introuvable." };
    }
    resolvedTarget = { ...target, externalOccupationId: externalTarget.id };
  }
  return { ok: true, notes: await repository.listNotes(resolvedTarget) };
}
