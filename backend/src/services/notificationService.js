const { Notification, User, AmbulanceAssignment } = require('../models');
const { emitNotification, emitBulkNotifications } = require('../socket/socketHandler');

async function findSuperadmins() {
  return User.find({ role: 'superadmin', status: 'active' }).lean();
}

async function findAdminsByOrganization(orgId) {
  return User.find({
    organization_id: orgId,
    role: { $in: ['hospital_admin', 'fleet_admin'] },
    status: 'active'
  }).lean();
}

async function findUsersAssignedToAmbulance(ambulanceId) {
  const assignments = await AmbulanceAssignment.find({
    ambulance_id: ambulanceId,
    is_active: true
  }).lean();
  const userIds = assignments.map((a) => a.user_id);
  if (userIds.length === 0) return [];
  return User.find({ _id: { $in: userIds }, status: 'active' }).lean();
}

async function createNotification(userId, type, title, message, data = null) {
  const doc = await Notification.create({
    user_id: userId,
    type,
    title,
    message,
    data
  });
  const json = doc.toJSON();
  emitNotification(String(userId), json);
  return json;
}

async function createBulkNotifications(notifications) {
  if (!notifications || notifications.length === 0) return [];
  const docs = await Notification.insertMany(
    notifications.map((n) => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data || null
    }))
  );
  const payload = docs.map((d) => ({ ...d.toJSON(), userId: String(d.user_id) }));
  emitBulkNotifications(payload);
  return payload;
}

async function notifySuperadminsPartnershipAccepted(collaborationData) {
  const superadmins = await findSuperadmins();
  return createBulkNotifications(
    superadmins.map((u) => ({
      userId: u._id,
      type: 'partnership_accepted',
      title: 'Partnership Request Accepted',
      message: `${collaborationData.requesterOrgName} accepted partnership with ${collaborationData.recipientOrgName}`,
      data: { collaborationId: collaborationData.id }
    }))
  );
}

async function notifySuperadminsNewAmbulance(ambulanceData) {
  const superadmins = await findSuperadmins();
  return createBulkNotifications(
    superadmins.map((u) => ({
      userId: u._id,
      type: 'new_ambulance',
      title: 'New Ambulance Created',
      message: `New ambulance ${ambulanceData.ambulance_code} created by ${ambulanceData.organizationName}`,
      data: { ambulanceId: ambulanceData.id }
    }))
  );
}

async function notifySuperadminsNewAdmin(userData) {
  const superadmins = await findSuperadmins();
  return createBulkNotifications(
    superadmins.map((u) => ({
      userId: u._id,
      type: 'new_admin_account',
      title: 'New Admin Account Created',
      message: `New ${userData.role} account created: ${userData.firstName} ${userData.lastName} at ${userData.organizationName}`,
      data: { userId: userData.id }
    }))
  );
}

async function notifyAdminsCollaborationRequest(adminOrgId, collaborationData) {
  const admins = await findAdminsByOrganization(adminOrgId);
  return createBulkNotifications(
    admins.map((u) => ({
      userId: u._id,
      type: 'collaboration_request',
      title: 'New Partnership Request',
      message: `${collaborationData.requesterOrgName} sent a partnership request`,
      data: { collaborationId: collaborationData.id }
    }))
  );
}

async function notifyAdminsCollaborationAccepted(adminOrgId, collaborationData) {
  const admins = await findAdminsByOrganization(adminOrgId);
  return createBulkNotifications(
    admins.map((u) => ({
      userId: u._id,
      type: 'collaboration_accepted',
      title: 'Partnership Request Accepted',
      message: `${collaborationData.recipientOrgName} accepted your partnership request`,
      data: { collaborationId: collaborationData.id }
    }))
  );
}

async function notifyAdminUserApproved(adminOrgId, userData) {
  const admins = await findAdminsByOrganization(adminOrgId);
  return createBulkNotifications(
    admins.map((u) => ({
      userId: u._id,
      type: 'user_approved',
      title: 'User Account Approved',
      message: `${userData.firstName} ${userData.lastName} (${userData.role}) has been approved`,
      data: { userId: userData.id }
    }))
  );
}

async function notifyAdminAmbulanceApproved(adminOrgId, ambulanceData) {
  const admins = await findAdminsByOrganization(adminOrgId);
  return createBulkNotifications(
    admins.map((u) => ({
      userId: u._id,
      type: 'ambulance_approved',
      title: 'Ambulance Approved',
      message: `Ambulance ${ambulanceData.ambulance_code} has been approved by superadmin`,
      data: { ambulanceId: ambulanceData.id }
    }))
  );
}

async function notifyUserAmbulanceAssignment(userId, ambulanceData) {
  return createNotification(
    userId,
    'ambulance_assigned',
    'Assigned to Ambulance',
    `You have been assigned to ambulance ${ambulanceData.ambulance_code}`,
    { ambulanceId: ambulanceData.id }
  );
}

async function notifyAmbulanceCrewPatientOnboarded(ambulanceId, patientData) {
  const assignedUsers = await findUsersAssignedToAmbulance(ambulanceId);
  return createBulkNotifications(
    assignedUsers.map((u) => ({
      userId: u._id,
      type: 'patient_onboarded',
      title: 'New Patient Onboarded',
      message: `Patient ${patientData.firstName} ${patientData.lastName} has been onboarded to your ambulance`,
      data: {
        sessionId: patientData.sessionId,
        patientId: patientData.patientId,
        ambulanceId
      }
    }))
  );
}

module.exports = {
  createNotification,
  createBulkNotifications,
  notifySuperadminsPartnershipAccepted,
  notifySuperadminsNewAmbulance,
  notifySuperadminsNewAdmin,
  notifyAdminsCollaborationRequest,
  notifyAdminsCollaborationAccepted,
  notifyAdminUserApproved,
  notifyAdminAmbulanceApproved,
  notifyUserAmbulanceAssignment,
  notifyAmbulanceCrewPatientOnboarded
};
