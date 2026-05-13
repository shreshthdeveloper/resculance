/**
 * Frontend Permission System
 * Mirrors backend RBAC permissions for UI control
 */

export const PERMISSIONS = {
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
  VIEW_PARTNERED_AMBULANCES: 'view_partnered_AMBULANCES',
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

const ROLE_PERMISSIONS = {
  superadmin: Object.values(PERMISSIONS),
  
  hospital_admin: [
    PERMISSIONS.VIEW_OWN_ORG_USERS,
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.UPDATE_USER,
    PERMISSIONS.APPROVE_USER,
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
  
  hospital_doctor: [
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
  
  hospital_paramedic: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.ONBOARD_PATIENT,
    PERMISSIONS.OFFBOARD_PATIENT,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  hospital_staff: [
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  fleet_admin: [
    PERMISSIONS.VIEW_OWN_ORG_USERS,
    PERMISSIONS.CREATE_USER,
    PERMISSIONS.UPDATE_USER,
    PERMISSIONS.APPROVE_USER,
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.CREATE_AMBULANCE,
    PERMISSIONS.UPDATE_AMBULANCE,
    PERMISSIONS.DELETE_AMBULANCE,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.ONBOARD_PATIENT,
    PERMISSIONS.OFFBOARD_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.VIEW_COLLABORATIONS,
    PERMISSIONS.APPROVE_COLLABORATION,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ANALYTICS
  ],
  
  fleet_doctor: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.ONBOARD_PATIENT,
    PERMISSIONS.OFFBOARD_PATIENT,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  fleet_paramedic: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.ASSIGN_STAFF,
    PERMISSIONS.VIEW_PATIENTS,
    PERMISSIONS.CREATE_PATIENT,
    PERMISSIONS.UPDATE_PATIENT,
    PERMISSIONS.VIEW_VITAL_SIGNS,
    PERMISSIONS.ONBOARD_PATIENT,
    PERMISSIONS.OFFBOARD_PATIENT,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  fleet_driver: [
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.VIEW_DASHBOARD
  ],
  
  fleet_staff: [
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_DASHBOARD
  ]
};

/**
 * Check if a role has a specific permission
 */
export const hasPermission = (role, permission) => {
  if (!role) return false;
  
  // Normalize the role to handle both generic (ADMIN, DOCTOR) and specific (hospital_admin, fleet_admin) roles
  const normalizedRole = (role || '').toString().toLowerCase().trim();
  
  // Try direct match first
  let permissions = ROLE_PERMISSIONS[normalizedRole] || [];
  
  // If no direct match and role is generic, try inferring from context
  // For generic roles like 'admin', 'doctor', etc., we'll use hospital variant as default
  if (permissions.length === 0) {
    if (normalizedRole === 'admin') {
      // Admin gets union of hospital_admin and fleet_admin permissions
      const hospitalAdminPerms = ROLE_PERMISSIONS['hospital_admin'] || [];
      const fleetAdminPerms = ROLE_PERMISSIONS['fleet_admin'] || [];
      permissions = [...new Set([...hospitalAdminPerms, ...fleetAdminPerms])];
    } else if (normalizedRole === 'doctor') {
      permissions = ROLE_PERMISSIONS['hospital_doctor'] || [];
    } else if (normalizedRole === 'paramedic') {
      permissions = ROLE_PERMISSIONS['hospital_paramedic'] || [];
    } else if (normalizedRole === 'driver') {
      permissions = ROLE_PERMISSIONS['fleet_driver'] || [];
    }
  }
  
  return permissions.includes(permission);
};

/**
 * Check if a role has any of the given permissions
 */
export const hasAnyPermission = (role, ...permissions) => {
  if (!role) return false;
  return permissions.some(permission => hasPermission(role, permission));
};

/**
 * Check if a role has all of the given permissions
 */
export const hasAllPermissions = (role, ...permissions) => {
  if (!role) return false;
  return permissions.every(permission => hasPermission(role, permission));
};

/**
 * Check if role is a medical staff (doctor/paramedic)
 */
export const isMedicalStaff = (role) => {
  const medicalRoles = ['hospital_doctor', 'hospital_paramedic', 'fleet_doctor', 'fleet_paramedic'];
  return medicalRoles.includes(role);
};

/**
 * Check if role is an admin
 */
export const isAdmin = (role) => {
  return ['superadmin', 'hospital_admin', 'fleet_admin'].includes(role);
};

/**
 * Check if user can see organization management
 */
export const canViewOrganizations = (role) => {
  return role === 'superadmin';
};

/**
 * Check if user needs org selection in forms
 */
export const needsOrgSelection = (role) => {
  return role === 'superadmin';
};

/**
 * Get allowed sidebar items for a role
 */
export const getAllowedSidebarItems = (role) => {
  const items = ['dashboard']; // Everyone gets dashboard
  
  if (hasPermission(role, PERMISSIONS.VIEW_ALL_ORGANIZATIONS)) {
    items.push('organizations');
  }
  
  if (hasAnyPermission(role, PERMISSIONS.VIEW_ALL_USERS, PERMISSIONS.VIEW_OWN_ORG_USERS)) {
    items.push('users');
  }
  
  if (hasAnyPermission(
    role,
    PERMISSIONS.VIEW_ALL_AMBULANCES,
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.VIEW_PARTNERED_AMBULANCES
  )) {
    items.push('ambulances');
  }
  
  if (hasPermission(role, PERMISSIONS.VIEW_PATIENTS)) {
    items.push('patients');
  }

  // Onboarding (patient sessions) visible to roles that can onboard/offboard
  if (hasAnyPermission(role, PERMISSIONS.ONBOARD_PATIENT, PERMISSIONS.OFFBOARD_PATIENT)) {
    items.push('onboarding');
  }

  // Sessions History - Available to all authenticated users
  items.push('sessions');
  
  if (hasPermission(role, PERMISSIONS.VIEW_COLLABORATIONS)) {
    items.push('collaborations');
  }

  // Activity logs (superadmin only)
  if (hasPermission(role, PERMISSIONS.VIEW_ACTIVITY_LOGS)) {
    items.push('activity');
    items.push('permissions'); // Permissions page also for superadmin
  }
  
  return items;
};

export default {
  PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isMedicalStaff,
  isAdmin,
  canViewOrganizations,
  needsOrgSelection,
  getAllowedSidebarItems
};
