export default function PermissionGate({ permissions, permission, children, fallback = null }) {
  if (!permission || !permissions || permissions.can(permission)) return children;
  return fallback;
}
