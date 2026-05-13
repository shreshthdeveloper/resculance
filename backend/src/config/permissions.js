/**
 * Role-Based Access Control (RBAC) Configuration
 * Defines permissions for each role in the system
 */

const ROLES = {
  SUPERADMIN: 'superadmin',
  HOSPITAL_ADMIN: 'hospital_admin',
  HOSPITAL_DOCTOR: 'hospital_doctor',
  HOSPITAL_PARAMEDIC: 'hospital_paramedic',
  HOSPITAL_STAFF: 'hospital_staff',
  FLEET_ADMIN: 'fleet_admin',
  FLEET_DOCTOR: 'fleet_doctor',
  FLEET_PARAMEDIC: 'fleet_paramedic',
  FLEET_DRIVER: 'fleet_driver',
  FLEET_STAFF: 'fleet_staff'
};

const PERMISSIONS = {
  // Organization permissions
  VIEW_ALL_ORGANIZATIONS: 'view_all_organizations',
  CREATE_ORGANIZATION: 'create_organization',
  UPDATE_ORGANIZATION: 'update_organization',
  DELETE_ORGANIZATION: 'delete_organization',
  
  // User permissions
  VIEW_ALL_USERS: 'view_all_users',
  VIEW_OWN_ORG_USERS: 'view_own_org_users',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  APPROVE_USER: 'approve_user',
  APPROVE_ADMIN: 'approve_admin',
  DELETE_USER: 'delete_user',
  
  // Ambulance permissions
  VIEW_ALL_AMBULANCES: 'view_all_ambulances',
  VIEW_OWN_AMBULANCES: 'view_own_ambulances',
  VIEW_ASSIGNED_AMBULANCES: 'view_assigned_ambulances',
  VIEW_PARTNERED_AMBULANCES: 'view_partnered_ambulances',
  CREATE_AMBULANCE: 'create_ambulance',
  UPDATE_AMBULANCE: 'update_ambulance',
  APPROVE_AMBULANCE: 'approve_ambulance',
  DELETE_AMBULANCE: 'delete_ambulance',
  ASSIGN_STAFF: 'assign_staff',
  
  // Patient permissions
  VIEW_PATIENTS: 'view_patients',
  CREATE_PATIENT: 'create_patient',
  UPDATE_PATIENT: 'update_patient',
  ONBOARD_PATIENT: 'onboard_patient',
  OFFBOARD_PATIENT: 'offboard_patient',
  VIEW_VITAL_SIGNS: 'view_vital_signs',
  
  // Collaboration permissions
  VIEW_COLLABORATIONS: 'view_collaborations',
  CREATE_COLLABORATION: 'create_collaboration',
  APPROVE_COLLABORATION: 'approve_collaboration',
  REJECT_COLLABORATION: 'reject_collaboration',
  
  // Dashboard permissions
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ANALYTICS: 'view_analytics',

  // Activity log permissions (superadmin only)
  VIEW_ACTIVITY_LOGS: 'view_activity_logs'
};

// Role to permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: Object.values(PERMISSIONS), // Superadmin has all permissions
  
  [ROLES.HOSPITAL_ADMIN]: [
    PERMISSIONS.VIEW_OWN_ORG_USERS,
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.UPDATE_USER,
    PERMISSIONS.APPROVE_USER, // Can approve doctors, paramedics, staff but NOT other admins
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_PARTNERED_AMBULANCES,
    PERMISSIONS.CREATE_AMBULANCE,
    PERMISSIONS.UPDATE_AMBULANCE,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.ONBOARD_PATIENT,
    PERMISSIONS.OFFBOARD_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_COLLABORATIONS,
    PERMISSIONS.CREATE_COLLABORATION,
    PERMISSIONS.APPROVE_COLLABORATION,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  
  [ROLES.HOSPITAL_DOCTOR]: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.ONBOARD_PATIENT,
    PERMISSIONS.OFFBOARD_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  [ROLES.HOSPITAL_PARAMEDIC]: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  [ROLES.HOSPITAL_STAFF]: [
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  [ROLES.FLEET_ADMIN]: [
    PERMISSIONS.VIEW_OWN_ORG_USERS,
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.UPDATE_USER,
    PERMISSIONS.APPROVE_USER, // Can approve doctors, paramedics, drivers, staff but NOT other admins
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.CREATE_AMBULANCE,
    PERMISSIONS.UPDATE_AMBULANCE,
    PERMISSIONS.DELETE_AMBULANCE,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_COLLABORATIONS,
    PERMISSIONS.APPROVE_COLLABORATION,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  
  [ROLES.FLEET_DOCTOR]: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  [ROLES.FLEET_PARAMEDIC]: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  [ROLES.FLEET_DRIVER]: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  [ROLES.FLEET_STAFF]: [
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_DASHBOARD
  ]
};

/**
 * Check if a role has a specific permission
 * @param {string} role - User role
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
const hasPermission = (role, permission) => {
  if (!role) return false;
  const roleKey = String(role).toLowerCase();
  const permissions = ROLE_PERMISSIONS[roleKey] || [];
  return permissions.includes(permission);
};

/**
 * Check if a role can approve a specific user role
 * Admins cannot approve other admins
 * @param {string} approverRole - Role of the user approving
 * @param {string} targetRole - Role of the user being approved
 * @returns {boolean}
 */
const canApproveRole = (approverRole, targetRole) => {
  if (!approverRole) return false;
  const a = String(approverRole).toLowerCase();
  const t = targetRole ? String(targetRole).toLowerCase() : '';

  if (a === ROLES.SUPERADMIN) return true;

  const adminRoles = [ROLES.HOSPITAL_ADMIN, ROLES.FLEET_ADMIN];
  // Prevent admins approving other admins (case-insensitive)
  if (adminRoles.includes(a) && adminRoles.includes(t)) {
    return false;
  }

  return hasPermission(a, PERMISSIONS.APPROVE_USER);
};

/**
 * Get all permissions for a role
 * @param {string} role - User role
 * @returns {Array<string>}
 */
const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Check if role is a medical staff (doctor/paramedic)
 * @param {string} role - User role
 * @returns {boolean}
 */
const isMedicalStaff = (role) => {
  const medicalRoles = [
    ROLES.HOSPITAL_DOCTOR,
    ROLES.HOSPITAL_PARAMEDIC,
    ROLES.FLEET_DOCTOR,
    ROLES.FLEET_PARAMEDIC
  ];
  return medicalRoles.includes(role);
};

/**
 * Check if role is an admin
 * @param {string} role - User role
 * @returns {boolean}
 */
const isAdmin = (role) => {
  return [ROLES.SUPERADMIN, ROLES.HOSPITAL_ADMIN, ROLES.FLEET_ADMIN].includes(role);
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  canApproveRole,
  getRolePermissions,
  isMedicalStaff,
  isAdmin
};
