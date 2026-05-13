// RBAC mirror of the web frontend's permissions util.
// Source of truth: frontend/src/utils/permissions.js + backend/src/config/permissions.js
//
// Keeping this in sync with the web side means a paramedic on mobile sees
// the same Manage entries a paramedic sees on web (minus the ones we
// haven't ported yet). When the backend ROLES or PERMISSIONS lists change,
// update this file too.

export const PERMISSIONS = {
  // Organization
  VIEW_ALL_ORGANIZATIONS: 'view_all_organizations',
  CREATE_ORGANIZATION: 'create_organization',
  UPDATE_ORGANIZATION: 'update_organization',
  DELETE_ORGANIZATION: 'delete_organization',

  // User
  VIEW_ALL_USERS: 'view_all_users',
  VIEW_OWN_ORG_USERS: 'view_own_org_users',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  APPROVE_USER: 'approve_user',
  APPROVE_ADMIN: 'approve_admin',
  DELETE_USER: 'delete_user',

  // Ambulance
  VIEW_ALL_AMBULANCES: 'view_all_ambulances',
  VIEW_OWN_AMBULANCES: 'view_own_ambulances',
  VIEW_ASSIGNED_AMBULANCES: 'view_assigned_ambulances',
  VIEW_PARTNERED_AMBULANCES: 'view_partnered_ambulances',
  CREATE_AMBULANCE: 'create_ambulance',
  UPDATE_AMBULANCE: 'update_ambulance',
  APPROVE_AMBULANCE: 'approve_ambulance',
  DELETE_AMBULANCE: 'delete_ambulance',
  ASSIGN_STAFF: 'assign_staff',

  // Patient
  VIEW_PATIENTS: 'view_patients',
  CREATE_PATIENT: 'create_patient',
  UPDATE_PATIENT: 'update_patient',
  ONBOARD_PATIENT: 'onboard_patient',
  OFFBOARD_PATIENT: 'offboard_patient',
  VIEW_VITAL_SIGNS: 'view_vital_signs',

  // Collaboration
  VIEW_COLLABORATIONS: 'view_collaborations',
  CREATE_COLLABORATION: 'create_collaboration',
  APPROVE_COLLABORATION: 'approve_collaboration',
  REJECT_COLLABORATION: 'reject_collaboration',

  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ANALYTICS: 'view_analytics',

  // Activity logs (superadmin only)
  VIEW_ACTIVITY_LOGS: 'view_activity_logs',
};

const P = PERMISSIONS;

// Same role → permission map as the web. Don't drift; if the backend's
// config/permissions.js changes, update this file.
const ROLE_PERMISSIONS = {
  superadmin: Object.values(P),

  hospital_admin: [
    P.VIEW_OWN_ORG_USERS, P.CREATE_USER, P.UPDATE_USER, P.APPROVE_USER,
    P.VIEW_OWN_AMBULANCES, P.VIEW_PARTNERED_AMBULANCES, P.CREATE_AMBULANCE,
    P.UPDATE_AMBULANCE, P.ASSIGN_STAFF,
    P.VIEW_PATIENTS, P.CREATE_PATIENT, P.UPDATE_PATIENT,
    P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT, P.VIEW_VITAL_SIGNS,
    P.VIEW_COLLABORATIONS, P.CREATE_COLLABORATION, P.APPROVE_COLLABORATION,
    P.VIEW_DASHBOARD, P.VIEW_ANALYTICS,
  ],

  hospital_doctor: [
    P.VIEW_ASSIGNED_AMBULANCES, P.ASSIGN_STAFF,
    P.VIEW_PATIENTS, P.CREATE_PATIENT, P.UPDATE_PATIENT,
    P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT, P.VIEW_VITAL_SIGNS,
    P.VIEW_DASHBOARD,
  ],

  hospital_paramedic: [
    P.VIEW_ASSIGNED_AMBULANCES, P.ASSIGN_STAFF,
    P.VIEW_PATIENTS, P.CREATE_PATIENT, P.UPDATE_PATIENT, P.VIEW_VITAL_SIGNS,
    P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT,
    P.VIEW_DASHBOARD,
  ],

  hospital_staff: [
    P.VIEW_OWN_AMBULANCES, P.VIEW_PATIENTS, P.VIEW_VITAL_SIGNS, P.VIEW_DASHBOARD,
  ],

  fleet_admin: [
    P.VIEW_OWN_ORG_USERS, P.CREATE_USER, P.UPDATE_USER, P.APPROVE_USER,
    P.VIEW_OWN_AMBULANCES, P.CREATE_AMBULANCE, P.UPDATE_AMBULANCE,
    P.DELETE_AMBULANCE, P.ASSIGN_STAFF,
    P.VIEW_PATIENTS, P.CREATE_PATIENT, P.UPDATE_PATIENT,
    P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT, P.VIEW_VITAL_SIGNS,
    P.VIEW_COLLABORATIONS, P.APPROVE_COLLABORATION,
    P.VIEW_DASHBOARD, P.VIEW_ANALYTICS,
  ],

  fleet_doctor: [
    P.VIEW_ASSIGNED_AMBULANCES, P.ASSIGN_STAFF,
    P.VIEW_PATIENTS, P.CREATE_PATIENT, P.UPDATE_PATIENT, P.VIEW_VITAL_SIGNS,
    P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT,
    P.VIEW_DASHBOARD,
  ],

  fleet_paramedic: [
    P.VIEW_ASSIGNED_AMBULANCES, P.ASSIGN_STAFF,
    P.VIEW_PATIENTS, P.CREATE_PATIENT, P.UPDATE_PATIENT, P.VIEW_VITAL_SIGNS,
    P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT,
    P.VIEW_DASHBOARD,
  ],

  fleet_driver: [P.VIEW_ASSIGNED_AMBULANCES, P.VIEW_DASHBOARD],

  fleet_staff: [P.VIEW_OWN_AMBULANCES, P.VIEW_DASHBOARD],
};

export function hasPermission(role, permission) {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  const perms = ROLE_PERMISSIONS[r] ?? [];
  return perms.includes(permission);
}

export function hasAnyPermission(role, ...perms) {
  return perms.some((p) => hasPermission(role, p));
}

export function isAdmin(role) {
  return ['superadmin', 'hospital_admin', 'fleet_admin'].includes(role);
}

export function isMedicalStaff(role) {
  return ['hospital_doctor', 'hospital_paramedic', 'fleet_doctor', 'fleet_paramedic'].includes(role);
}

// What a given role should see in the Manage / sidebar area. Returns a
// list of canonical keys: 'dashboard', 'organizations', 'users',
// 'ambulances', 'patients', 'onboarding', 'sessions', 'collaborations',
// 'activity', 'permissions'. The mobile UI maps these keys to routes.
export function getAllowedSidebarItems(role) {
  const items = ['dashboard']; // everyone

  if (hasPermission(role, P.VIEW_ALL_ORGANIZATIONS)) items.push('organizations');

  if (hasAnyPermission(role, P.VIEW_ALL_USERS, P.VIEW_OWN_ORG_USERS)) items.push('users');

  if (hasAnyPermission(
    role,
    P.VIEW_ALL_AMBULANCES,
    P.VIEW_OWN_AMBULANCES,
    P.VIEW_ASSIGNED_AMBULANCES,
    P.VIEW_PARTNERED_AMBULANCES,
  )) items.push('ambulances');

  if (hasPermission(role, P.VIEW_PATIENTS)) items.push('patients');

  if (hasAnyPermission(role, P.ONBOARD_PATIENT, P.OFFBOARD_PATIENT)) items.push('onboarding');

  items.push('sessions'); // everyone

  if (hasPermission(role, P.VIEW_COLLABORATIONS)) items.push('collaborations');

  if (hasPermission(role, P.VIEW_ACTIVITY_LOGS)) {
    items.push('activity');
    items.push('permissions');
  }

  return items;
}

// Mobile-only helper — what to surface on the Home Manage grid.
// Each entry: { key, label, sub, icon, route }.
const MANAGE_ITEMS = {
  patients:       { label: 'Patients',       sub: 'Search, edit, archive',  icon: 'people',         route: '/patients' },
  ambulances:     { label: 'Ambulances',     sub: 'Fleet management',       icon: 'car-sport',      route: '/ambulances' },
  users:          { label: 'Users',          sub: 'Roles + approvals',      icon: 'person-add',     route: '/users' },
  collaborations: { label: 'Partnerships',   sub: 'Org collaborations',     icon: 'git-network',    route: '/collaborations' },
  organizations:  { label: 'Organizations',  sub: 'Create + lifecycle',     icon: 'business',       route: '/organizations' },
  activity:       { label: 'Activity logs',  sub: 'Audit trail',            icon: 'reader',         route: '/activity' },
  permissions:    { label: 'Permissions',    sub: 'Role matrix',            icon: 'shield-checkmark', route: '/permissions' },
  sessions:       { label: 'Sessions',       sub: 'Active + history',       icon: 'pulse',          route: '/sessions' },
  // "Onboarding" matches the web sidebar's Onboarding section: a list of
  // currently active sessions (onboarded + in_transit) that opens the
  // ambulance console when tapped.
  onboarding:     { label: 'Onboarding',     sub: 'Active ambulance console', icon: 'medkit',     route: '/onboardings' },
};

export function getManageTiles(role) {
  // Order matches the web sidebar's reading order: Org → Users → Amb →
  // Patients → Onboarding → Partnerships → Activity → Permissions.
  const order = [
    'organizations', 'users', 'ambulances', 'patients',
    'onboarding', 'collaborations', 'activity', 'permissions',
  ];
  const allowed = new Set(getAllowedSidebarItems(role));
  return order
    .filter((k) => allowed.has(k))
    .map((k) => ({ key: k, ...MANAGE_ITEMS[k] }));
}
