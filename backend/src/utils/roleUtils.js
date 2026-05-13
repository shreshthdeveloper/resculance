const { ORG_TYPES } = require('../config/constants');

// Maps generic roles to backend enums based on organization type
const ROLE_MAP = {
  doctor: {
    [ORG_TYPES.HOSPITAL]: 'hospital_doctor',
    [ORG_TYPES.FLEET_OWNER]: 'fleet_doctor'
  },
  paramedic: {
    [ORG_TYPES.HOSPITAL]: 'hospital_paramedic',
    [ORG_TYPES.FLEET_OWNER]: 'fleet_paramedic'
  },
  admin: {
    [ORG_TYPES.HOSPITAL]: 'hospital_admin',
    [ORG_TYPES.FLEET_OWNER]: 'fleet_admin'
  },
  staff: {
    [ORG_TYPES.HOSPITAL]: 'hospital_staff',
    [ORG_TYPES.FLEET_OWNER]: 'fleet_staff'
  },
  superadmin: 'superadmin'
};

function toKey(val) {
  if (!val) return val;
  return String(val).trim().toLowerCase().replace(/[-_\s]+/g, '_');
}

async function getOrgTypeById(orgId) {
  if (!orgId) return null;
  // Lazy require to avoid circular deps with models
  const Organization = require('../models/Organization');
  const org = await Organization.findById(orgId).select('type').lean();
  return org ? org.type : null;
}

/**
 * Normalize incoming role to backend enum.
 * Accepts values like 'DOCTOR', 'doctor', 'hospital_doctor' and maps based on orgType.
 * If orgType is not provided and orgId is, it will look it up.
 */
async function normalizeRole(inputRole, orgType, orgId) {
  if (!inputRole) return inputRole;

  const key = toKey(inputRole);

  // If already a backend enum, return as-is
  if (key.startsWith('hospital_') || key.startsWith('fleet_') || key === 'superadmin' || key === 'super_admin') {
    return key.replace('super_admin', 'superadmin');
  }

  let resolvedOrgType = orgType;
  if (!resolvedOrgType && orgId) {
    resolvedOrgType = await getOrgTypeById(orgId);
  }

  if (ROLE_MAP[key]) {
    const mapped = ROLE_MAP[key];
    if (typeof mapped === 'string') return mapped;
    if (resolvedOrgType && mapped[resolvedOrgType]) return mapped[resolvedOrgType];
    return mapped[ORG_TYPES.HOSPITAL];
  }

  if (key === 'driver') {
    return ORG_TYPES.FLEET_OWNER === resolvedOrgType ? 'fleet_staff' : 'hospital_staff';
  }

  return inputRole;
}

function normalizeStatus(inputStatus) {
  if (!inputStatus) return inputStatus;
  const s = toKey(inputStatus);
  if (s === 'pending' || s === 'pending_approval') return 'pending_approval';
  if (s === 'active') return 'active';
  if (s === 'suspended') return 'suspended';
  if (s === 'inactive') return 'inactive';
  return inputStatus;
}

module.exports = { normalizeRole, normalizeStatus };
