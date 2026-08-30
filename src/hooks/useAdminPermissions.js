import { useMemo } from "react";
import { ADMIN_ROLES, can, canViewTab, getEffectivePermissions, isOwnerProfile } from "../utils/adminPermissions";

export function useAdminPermissions(session, currentAdminUser = null) {
  return useMemo(() => {
    const role = currentAdminUser?.role || null;
    const permissionSet = getEffectivePermissions(currentAdminUser);
    const isOwner = isOwnerProfile(currentAdminUser);

    return {
      role,
      currentAdminUser,
      permissionSet,
      isOwner,
      can: (permission) => isOwner || can(permissionSet, permission),
      canViewTab: (tabKey) => isOwner || canViewTab(permissionSet, tabKey),
      isReadOnly: false,
      isHousekeeping: role === ADMIN_ROLES.HOUSEKEEPING,
    };
  }, [session, currentAdminUser]);
}
