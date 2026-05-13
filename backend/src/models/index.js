/**
 * Central model export. Importing this module ensures every schema is
 * registered with mongoose before any `populate()` calls happen.
 */
module.exports = {
  Organization: require('./Organization'),
  User: require('./User'),
  Ambulance: require('./Ambulance'),
  AmbulanceAssignment: require('./AmbulanceAssignment'),
  AmbulanceDevice: require('./AmbulanceDevice'),
  Patient: require('./Patient'),
  PatientSession: require('./PatientSession'),
  PatientSessionData: require('./PatientSessionData'),
  VitalSign: require('./VitalSign'),
  Communication: require('./Communication'),
  Notification: require('./Notification'),
  CollaborationRequest: require('./CollaborationRequest'),
  Partnership: require('./Partnership'),
  ActivityLog: require('./ActivityLog'),
  AuditLog: require('./AuditLog'),
  RefreshToken: require('./RefreshToken')
};
