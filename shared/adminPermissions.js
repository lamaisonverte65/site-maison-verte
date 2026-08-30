export const ADMIN_ROLES = Object.freeze({
  OWNER: "owner",
  HOUSEKEEPING: "housekeeping",
});

export const ADMIN_PERMISSIONS = Object.freeze({
  viewRequests: "view:requests",
  viewReservations: "view:reservations",
  viewCalendar: "view:calendar",
  viewPricing: "view:pricing",
  viewCustomers: "view:customers",
  viewCrm: "view:crm",
  viewPayments: "view:payments",
  viewCommunication: "view:communication",
  viewStripePayouts: "view:stripe_payouts",
  viewReviews: "view:reviews",
  viewVisits: "view:visits",
  viewSummary: "view:summary",
  viewUsers: "view:users",
  manageReservations: "manage:reservations",
  manageCustomers: "manage:customers",
  managePayments: "manage:payments",
  manageCommunication: "manage:communication",
  manageReviews: "manage:reviews",
  manageCalendar: "manage:calendar",
  managePricing: "manage:pricing",
  manageSettings: "manage:settings",
  manageUsers: "manage:users",
  contactEmail: "contact:email",
  contactPhone: "contact:phone",
  contactSms: "contact:sms",
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(ADMIN_PERMISSIONS));
export const KNOWN_ROLES = Object.freeze(Object.values(ADMIN_ROLES));
export const DELEGABLE_ROLES = Object.freeze([ADMIN_ROLES.HOUSEKEEPING]);

export const TAB_PERMISSION_MAP = Object.freeze({
  requests: ADMIN_PERMISSIONS.viewRequests,
  reservations: ADMIN_PERMISSIONS.viewReservations,
  calendar: ADMIN_PERMISSIONS.viewCalendar,
  pricing: ADMIN_PERMISSIONS.viewPricing,
  customers: ADMIN_PERMISSIONS.viewCustomers,
  crm: ADMIN_PERMISSIONS.viewCrm,
  payments: ADMIN_PERMISSIONS.viewPayments,
  communication: ADMIN_PERMISSIONS.viewCommunication,
  stripe_payouts: ADMIN_PERMISSIONS.viewStripePayouts,
  reviews: ADMIN_PERMISSIONS.viewReviews,
  visits: ADMIN_PERMISSIONS.viewVisits,
  summary: ADMIN_PERMISSIONS.viewSummary,
  users: ADMIN_PERMISSIONS.viewUsers,
});

const HOUSEKEEPING_PERMISSIONS = Object.freeze([
  ADMIN_PERMISSIONS.viewCalendar,
  ADMIN_PERMISSIONS.contactEmail,
  ADMIN_PERMISSIONS.contactPhone,
  ADMIN_PERMISSIONS.contactSms,
]);

export const isOwnerProfile = (profile) => Boolean(
  profile?.role === ADMIN_ROLES.OWNER
  && profile?.is_owner === true
  && profile?.is_active === true,
);

export const isHousekeepingProfile = (profile) => Boolean(
  profile?.role === ADMIN_ROLES.HOUSEKEEPING
  && profile?.is_owner !== true
  && profile?.is_active === true,
);

export const isKnownRole = (role) => KNOWN_ROLES.includes(String(role || ""));
export const isKnownPermission = (permission) => ALL_PERMISSIONS.includes(permission);

export function getEffectivePermissions(profile) {
  if (isOwnerProfile(profile)) return new Set(ALL_PERMISSIONS);
  if (isHousekeepingProfile(profile)) return new Set(HOUSEKEEPING_PERMISSIONS);
  return new Set();
}

export const getSystemCapabilities = getEffectivePermissions;
export const getDefaultPermissionsForRole = (role) => (
  role === ADMIN_ROLES.OWNER ? [...ALL_PERMISSIONS]
    : role === ADMIN_ROLES.HOUSEKEEPING ? [...HOUSEKEEPING_PERMISSIONS]
      : []
);

export function getRoleLabel(role) {
  return ({ owner: "Propriétaire", housekeeping: "Ménage / accueil" })[role] || "Rôle non pris en charge";
}

export const can = (permissionSet, permission) => !permission || Boolean(permissionSet?.has?.(permission));
export const canViewTab = (permissionSet, tabKey) => can(permissionSet, TAB_PERMISSION_MAP[tabKey]);
export const isOwnerRole = (role) => role === ADMIN_ROLES.OWNER;
export const isHousekeepingRole = (role) => role === ADMIN_ROLES.HOUSEKEEPING;
