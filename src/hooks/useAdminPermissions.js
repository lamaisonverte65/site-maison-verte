import { useMemo } from "react";
import { ADMIN_ROLES, can, canViewTab, getAdminPermissions } from "../utils/adminPermissions";

export function useAdminPermissions(session, currentAdminUser = null) {
  return useMemo(() => {
    const metadataRole = session?.user?.app_metadata?.admin_role || session?.user?.user_metadata?.admin_role;
    const role = currentAdminUser?.role || metadataRole || ADMIN_ROLES.OWNER;
    const customPermissions = Array.isArray(currentAdminUser?.permissions) ? currentAdminUser.permissions : null;
    const permissionSet = getAdminPermissions(role, customPermissions);
    const isOwner = role === ADMIN_ROLES.OWNER || Boolean(currentAdminUser?.is_owner);

    return {
      role,
      currentAdminUser,
      permissionSet,
      isOwner,
      can: (permission) => isOwner || can(permissionSet, permission),
      canViewTab: (tabKey) => isOwner || canViewTab(permissionSet, tabKey),
      isReadOnly: role === ADMIN_ROLES.READ_ONLY,
    };
  }, [session, currentAdminUser]);
}
