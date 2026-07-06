import { styles } from "../adminStyles";
import { ADMIN_ROLES, getRoleLabel } from "../../../utils/adminPermissions";

export default function UserRoleBadge({ role, isOwner }) {
  const label = isOwner || role === ADMIN_ROLES.OWNER ? "Propriétaire" : getRoleLabel(role);
  return (
    <span style={{ ...styles.badge, background: isOwner ? "#fef3c7" : "#e0f2fe", color: isOwner ? "#92400e" : "#075985" }}>
      {label}
    </span>
  );
}
