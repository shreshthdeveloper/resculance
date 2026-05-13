const { ActivityLog } = require('../models');
const { ACTIVITY_TYPES } = require('../config/constants');

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

async function log({ activity, comments, user, organization = null, metadata = null, req = null }) {
  try {
    const firstName = user.firstName || user.first_name || '';
    const lastName = user.lastName || user.last_name || '';
    const userName = `${firstName} ${lastName}`.trim() || 'Unknown User';

    return await ActivityLog.create({
      activity,
      comments,
      user_id: user.id,
      user_name: userName,
      organization_id: organization?.id || organization?._id || null,
      organization_name: organization?.name || null,
      metadata,
      ip_address: req ? getClientIp(req) : null,
      user_agent: req ? req.headers['user-agent'] : null
    });
  } catch (err) {
    console.error('Failed to log activity:', err.message);
    return null;
  }
}

const logOrgCreated = (user, organization, req) =>
  log({
    activity: ACTIVITY_TYPES.ORG_CREATED,
    comments: `Organization created: ${organization.name} (${organization.type})`,
    user, organization,
    metadata: { organizationType: organization.type },
    req
  });

const logOrgDeactivated = (user, organization, req) =>
  log({
    activity: ACTIVITY_TYPES.ORG_DEACTIVATED,
    comments: `Organization deactivated: ${organization.name}`,
    user, organization, req
  });

const logOrgActivated = (user, organization, req) =>
  log({
    activity: ACTIVITY_TYPES.ORG_ACTIVATED,
    comments: `Organization activated: ${organization.name}`,
    user, organization, req
  });

const logOrgUpdated = (user, organization, changes, req) =>
  log({
    activity: ACTIVITY_TYPES.ORG_UPDATED,
    comments: `Organization updated: ${organization.name}`,
    user, organization, metadata: { changes }, req
  });

const partnershipMetadata = (fleetOrg, hospitalOrg) => ({
  fleetId: fleetOrg.id || fleetOrg._id,
  fleetName: fleetOrg.name,
  hospitalId: hospitalOrg.id || hospitalOrg._id,
  hospitalName: hospitalOrg.name
});

const logPartnershipRequested = (user, fleetOrg, hospitalOrg, req) =>
  log({
    activity: ACTIVITY_TYPES.PARTNERSHIP_REQUESTED,
    comments: `Partnership requested between ${fleetOrg.name} and ${hospitalOrg.name}`,
    user,
    organization: String(user.organizationId) === String(fleetOrg._id || fleetOrg.id) ? fleetOrg : hospitalOrg,
    metadata: partnershipMetadata(fleetOrg, hospitalOrg),
    req
  });

const logPartnershipAccepted = (user, fleetOrg, hospitalOrg, req) =>
  log({
    activity: ACTIVITY_TYPES.PARTNERSHIP_ACCEPTED,
    comments: `Partnership accepted between ${fleetOrg.name} and ${hospitalOrg.name}`,
    user,
    organization: String(user.organizationId) === String(fleetOrg._id || fleetOrg.id) ? fleetOrg : hospitalOrg,
    metadata: partnershipMetadata(fleetOrg, hospitalOrg),
    req
  });

const logPartnershipRejected = (user, fleetOrg, hospitalOrg, req) =>
  log({
    activity: ACTIVITY_TYPES.PARTNERSHIP_REJECTED,
    comments: `Partnership rejected between ${fleetOrg.name} and ${hospitalOrg.name}`,
    user,
    organization: String(user.organizationId) === String(fleetOrg._id || fleetOrg.id) ? fleetOrg : hospitalOrg,
    metadata: partnershipMetadata(fleetOrg, hospitalOrg),
    req
  });

const logPartnershipCancelled = (user, fleetOrg, hospitalOrg, req) =>
  log({
    activity: ACTIVITY_TYPES.PARTNERSHIP_CANCELLED,
    comments: `Partnership cancelled between ${fleetOrg.name} and ${hospitalOrg.name}`,
    user,
    organization: String(user.organizationId) === String(fleetOrg._id || fleetOrg.id) ? fleetOrg : hospitalOrg,
    metadata: partnershipMetadata(fleetOrg, hospitalOrg),
    req
  });

module.exports = {
  log,
  logOrgCreated,
  logOrgDeactivated,
  logOrgActivated,
  logOrgUpdated,
  logPartnershipRequested,
  logPartnershipAccepted,
  logPartnershipRejected,
  logPartnershipCancelled,
  getClientIp
};
