import { ADMIN_PERMISSIONS, isOwnerProfile } from "../../../shared/adminPermissions.js";

const hasAny = (permissions, expected) => expected.some((permission) => permissions?.has?.(permission));

export function canMutateReservationData(auth = {}) {
  return isOwnerProfile(auth.profile) && hasAny(auth.permissions, [
    ADMIN_PERMISSIONS.manageReservations,
    ADMIN_PERMISSIONS.manageCalendar,
  ]);
}

export function canMutateClientData(auth = {}) {
  return isOwnerProfile(auth.profile) && hasAny(auth.permissions, [
    ADMIN_PERMISSIONS.manageCustomers,
    ADMIN_PERMISSIONS.manageReservations,
    ADMIN_PERMISSIONS.manageCalendar,
  ]);
}
