export const ADMIN_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MANAGER: "manager",
  READ_ONLY: "read_only",
  HOUSEKEEPING: "housekeeping",
};

export const ADMIN_PERMISSIONS = {
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
  transferOwnership: "manage:owner_transfer",

  contactEmail: "contact:email",
  contactPhone: "contact:phone",
  contactSms: "contact:sms",
};

export const TAB_PERMISSION_MAP = {
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
};

export const PERMISSION_GROUPS = [
  {
    label: "Demandes & réservations",
    permissions: [
      ADMIN_PERMISSIONS.viewRequests,
      ADMIN_PERMISSIONS.viewReservations,
      ADMIN_PERMISSIONS.manageReservations,
    ],
  },
  {
    label: "Calendrier & tarifs",
    permissions: [
      ADMIN_PERMISSIONS.viewCalendar,
      ADMIN_PERMISSIONS.manageCalendar,
      ADMIN_PERMISSIONS.viewPricing,
      ADMIN_PERMISSIONS.managePricing,
    ],
  },
  {
    label: "Clients & CRM",
    permissions: [
      ADMIN_PERMISSIONS.viewCustomers,
      ADMIN_PERMISSIONS.manageCustomers,
      ADMIN_PERMISSIONS.viewCrm,
    ],
  },
  {
    label: "Communication",
    permissions: [
      ADMIN_PERMISSIONS.viewCommunication,
      ADMIN_PERMISSIONS.manageCommunication,
      ADMIN_PERMISSIONS.contactEmail,
      ADMIN_PERMISSIONS.contactPhone,
      ADMIN_PERMISSIONS.contactSms,
    ],
  },
  {
    label: "Paiements",
    permissions: [
      ADMIN_PERMISSIONS.viewPayments,
      ADMIN_PERMISSIONS.managePayments,
      ADMIN_PERMISSIONS.viewStripePayouts,
    ],
  },
  {
    label: "Pilotage",
    permissions: [
      ADMIN_PERMISSIONS.viewReviews,
      ADMIN_PERMISSIONS.manageReviews,
      ADMIN_PERMISSIONS.viewVisits,
      ADMIN_PERMISSIONS.viewSummary,
    ],
  },
  {
    label: "Administration",
    permissions: [
      ADMIN_PERMISSIONS.viewUsers,
      ADMIN_PERMISSIONS.manageUsers,
      ADMIN_PERMISSIONS.transferOwnership,
      ADMIN_PERMISSIONS.manageSettings,
    ],
  },
];

export const PERMISSION_LABELS = {
  [ADMIN_PERMISSIONS.viewRequests]: "Voir demandes",
  [ADMIN_PERMISSIONS.viewReservations]: "Voir réservations",
  [ADMIN_PERMISSIONS.viewCalendar]: "Voir calendrier",
  [ADMIN_PERMISSIONS.viewPricing]: "Voir tarifs",
  [ADMIN_PERMISSIONS.viewCustomers]: "Voir clients",
  [ADMIN_PERMISSIONS.viewCrm]: "Voir CRM",
  [ADMIN_PERMISSIONS.viewPayments]: "Voir paiements",
  [ADMIN_PERMISSIONS.viewCommunication]: "Voir communication",
  [ADMIN_PERMISSIONS.viewStripePayouts]: "Voir virements Stripe",
  [ADMIN_PERMISSIONS.viewReviews]: "Voir avis",
  [ADMIN_PERMISSIONS.viewVisits]: "Voir visites",
  [ADMIN_PERMISSIONS.viewSummary]: "Voir synthèse",
  [ADMIN_PERMISSIONS.viewUsers]: "Voir utilisateurs",
  [ADMIN_PERMISSIONS.manageReservations]: "Modifier réservations",
  [ADMIN_PERMISSIONS.manageCustomers]: "Modifier clients",
  [ADMIN_PERMISSIONS.managePayments]: "Actions paiements",
  [ADMIN_PERMISSIONS.manageCommunication]: "Envoyer communications",
  [ADMIN_PERMISSIONS.manageReviews]: "Modérer avis",
  [ADMIN_PERMISSIONS.manageCalendar]: "Modifier calendrier",
  [ADMIN_PERMISSIONS.managePricing]: "Modifier tarifs",
  [ADMIN_PERMISSIONS.manageSettings]: "Paramètres sensibles",
  [ADMIN_PERMISSIONS.manageUsers]: "Gérer utilisateurs",
  [ADMIN_PERMISSIONS.transferOwnership]: "Transférer propriété",
  [ADMIN_PERMISSIONS.contactEmail]: "Email direct",
  [ADMIN_PERMISSIONS.contactPhone]: "Appel direct",
  [ADMIN_PERMISSIONS.contactSms]: "SMS direct",
};

const ALL_PERMISSIONS = Object.values(ADMIN_PERMISSIONS);
const VIEW_PERMISSIONS = ALL_PERMISSIONS.filter((permission) => permission.startsWith("view:"));
const CONTACT_PERMISSIONS = [
  ADMIN_PERMISSIONS.contactEmail,
  ADMIN_PERMISSIONS.contactPhone,
  ADMIN_PERMISSIONS.contactSms,
  ADMIN_PERMISSIONS.viewCommunication,
];

const HOUSEKEEPING_PERMISSIONS = [
  ADMIN_PERMISSIONS.viewCalendar,
  ADMIN_PERMISSIONS.contactEmail,
  ADMIN_PERMISSIONS.contactPhone,
  ADMIN_PERMISSIONS.contactSms,
];

const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.OWNER]: ALL_PERMISSIONS,
  [ADMIN_ROLES.ADMIN]: ALL_PERMISSIONS.filter((permission) => permission !== ADMIN_PERMISSIONS.transferOwnership),
  [ADMIN_ROLES.MANAGER]: ALL_PERMISSIONS.filter((permission) => ![
    ADMIN_PERMISSIONS.manageSettings,
    ADMIN_PERMISSIONS.manageUsers,
    ADMIN_PERMISSIONS.transferOwnership,
  ].includes(permission)),
  [ADMIN_ROLES.READ_ONLY]: [...VIEW_PERMISSIONS, ...CONTACT_PERMISSIONS],
  [ADMIN_ROLES.HOUSEKEEPING]: HOUSEKEEPING_PERMISSIONS,
};

export function getRoleLabel(role) {
  const labels = {
    [ADMIN_ROLES.OWNER]: "Propriétaire",
    [ADMIN_ROLES.ADMIN]: "Administrateur",
    [ADMIN_ROLES.MANAGER]: "Gestionnaire",
    [ADMIN_ROLES.READ_ONLY]: "Lecture seule",
    [ADMIN_ROLES.HOUSEKEEPING]: "Ménage",
  };
  return labels[role] || role || "-";
}

export function getDefaultPermissionsForRole(role = ADMIN_ROLES.READ_ONLY) {
  return [...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ADMIN_ROLES.READ_ONLY])];
}

export function normalizePermissionSet(value, role = ADMIN_ROLES.READ_ONLY) {
  if (Array.isArray(value) && value.length > 0) return [...new Set(value)];
  return getDefaultPermissionsForRole(role);
}

export function getAdminPermissions(role = ADMIN_ROLES.OWNER, customPermissions = null) {
  if (role === ADMIN_ROLES.HOUSEKEEPING) {
    return new Set(ROLE_PERMISSIONS[ADMIN_ROLES.HOUSEKEEPING]);
  }
  if (Array.isArray(customPermissions) && customPermissions.length > 0) {
    return new Set(customPermissions);
  }
  return new Set(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ADMIN_ROLES.OWNER]);
}

export function can(permissionSet, permission) {
  if (!permission) return true;
  if (!permissionSet) return true;
  return permissionSet.has(permission);
}

export function canViewTab(permissionSet, tabKey) {
  return can(permissionSet, TAB_PERMISSION_MAP[tabKey]);
}

export function isOwnerRole(role) {
  return role === ADMIN_ROLES.OWNER;
}


export function isHousekeepingRole(role) {
  return role === ADMIN_ROLES.HOUSEKEEPING;
}
