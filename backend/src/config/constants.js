module.exports = {
  // User roles
  ROLES: {
    SUPERADMIN: 'superadmin',
    HOSPITAL_ADMIN: 'hospital_admin',
    HOSPITAL_STAFF: 'hospital_staff',
    HOSPITAL_DOCTOR: 'hospital_doctor',
    HOSPITAL_PARAMEDIC: 'hospital_paramedic',
    FLEET_ADMIN: 'fleet_admin',
    FLEET_STAFF: 'fleet_staff',
    FLEET_DOCTOR: 'fleet_doctor',
    FLEET_PARAMEDIC: 'fleet_paramedic'
  },

  // Organization types
  ORG_TYPES: {
    HOSPITAL: 'hospital',
    FLEET_OWNER: 'fleet_owner',
    SUPERADMIN: 'superadmin'
  },

  // Organization types available for selection (excludes superadmin)
  ORG_TYPES_SELECTABLE: {
    HOSPITAL: 'hospital',
    FLEET_OWNER: 'fleet_owner'
  },

  // Ambulance statuses
  AMBULANCE_STATUS: {
    PENDING_APPROVAL: 'pending_approval',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    EN_ROUTE: 'en_route',
    MAINTENANCE: 'maintenance',
    SUSPENDED: 'suspended',
    AVAILABLE: 'available',
    ON_TRIP: 'on_trip',
    EMERGENCY: 'emergency',
    DISABLED: 'disabled'
  },

  // Patient session statuses
  PATIENT_STATUS: {
    ONBOARDED: 'onboarded',
    IN_TRANSIT: 'in_transit',
    OFFBOARDED: 'offboarded',
    CANCELLED: 'cancelled'
  },

  // Collaboration request statuses
  COLLABORATION_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
  },

  // User account statuses
  USER_STATUS: {
    PENDING_APPROVAL: 'pending_approval',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended'
  },

  // Communication types
  COMMUNICATION_TYPES: {
    TEXT: 'text',
    CALL: 'call',
    VIDEO: 'video'
  },

  // Device types
  DEVICE_TYPES: {
    ECG: 'ecg',
    BP_MONITOR: 'bp_monitor',
    PULSE_OXIMETER: 'pulse_oximeter',
    GLUCOSE_MONITOR: 'glucose_monitor',
    GPS_TRACKER: 'gps_tracker',
    TEMPERATURE: 'temperature',
    VENTILATOR: 'ventilator'
  },

  // Socket events
  SOCKET_EVENTS: {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    JOIN_AMBULANCE: 'join_ambulance',
    LEAVE_AMBULANCE: 'leave_ambulance',
    JOIN_SESSION: 'join_session',
    LEAVE_SESSION: 'leave_session',
    VITAL_UPDATE: 'vital_update',
    LOCATION_UPDATE: 'location_update',
    MESSAGE: 'message',
    CALL_REQUEST: 'call_request',
    CALL_ANSWER: 'call_answer',
    CALL_END: 'call_end',
    // Deprecated 1:1 video call events (kept for backward compatibility)
    VIDEO_REQUEST: 'video_request',
    VIDEO_ANSWER: 'video_answer',
    VIDEO_END: 'video_end',
    // New multi-participant video room events
    JOIN_VIDEO_ROOM: 'join_video_room',
    LEAVE_VIDEO_ROOM: 'leave_video_room',
    VIDEO_ROOM_JOINED: 'video_room_joined',
    USER_JOINED_VIDEO: 'user_joined_video',
    USER_LEFT_VIDEO: 'user_left_video',
    WEBRTC_SIGNAL: 'webrtc_signal',
    SESSION_DATA_ADDED: 'session_data_added',
    SESSION_DATA_DELETED: 'session_data_deleted'
  },

  // Activity types for audit logging
  ACTIVITY_TYPES: {
    ORG_CREATED: 'organization_created',
    ORG_DEACTIVATED: 'organization_deactivated',
    ORG_ACTIVATED: 'organization_activated',
    ORG_UPDATED: 'organization_updated',
    PARTNERSHIP_REQUESTED: 'partnership_requested',
    PARTNERSHIP_ACCEPTED: 'partnership_accepted',
    PARTNERSHIP_REJECTED: 'partnership_rejected',
    PARTNERSHIP_CANCELLED: 'partnership_cancelled',
    USER_CREATED: 'user_created',
    USER_UPDATED: 'user_updated',
    USER_APPROVED: 'user_approved',
    USER_SUSPENDED: 'user_suspended',
    USER_ACTIVATED: 'user_activated',
    AMBULANCE_CREATED: 'ambulance_created',
    AMBULANCE_UPDATED: 'ambulance_updated',
    AMBULANCE_DISABLED: 'ambulance_disabled',
    AMBULANCE_ACTIVATED: 'ambulance_activated',
    PATIENT_CREATED: 'patient_created',
    PATIENT_UPDATED: 'patient_updated',
    PATIENT_DEACTIVATED: 'patient_deactivated',
    PATIENT_ACTIVATED: 'patient_activated',
    PATIENT_ONBOARDED: 'patient_onboarded',
    PATIENT_OFFBOARDED: 'patient_offboarded'
  }
};
