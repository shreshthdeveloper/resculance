const {
  Patient, PatientSession, PatientSessionData, Ambulance, AmbulanceAssignment,
  Organization, VitalSign, Communication, User, Partnership
} = require('../models');
const { AppError } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');
const ActivityLogService = require('../services/activityLogService');
const { ACTIVITY_TYPES } = require('../config/constants');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');
const { generateCode } = require('../utils/codes');
const log = require('../utils/logger').child('patient');
const ACTIVE_SESSION_STATUSES = ['onboarded', 'in_transit'];

// ---------- helpers ----------

function mapPatient(p) {
  if (!p) return null;
  const o = p.toObject ? p.toObject() : p;
  return {
    ...o,
    id: String(o._id || o.id),
    organization_id: o.organization_id ? String(o.organization_id) : null,
    organizationId: o.organization_id ? String(o.organization_id) : null,
    firstName: o.first_name,
    lastName: o.last_name,
    bloodGroup: o.blood_group,
    phone: o.phone || o.contact_phone,
    emergencyContactName: o.emergency_contact_name,
    emergencyContactPhone: o.emergency_contact_phone,
    emergencyContactRelation: o.emergency_contact_relation,
    medicalHistory: o.medical_history,
    currentMedications: o.current_medications,
    isDataHidden: o.is_data_hidden,
    hiddenBy: o.hidden_by,
    hiddenAt: o.hidden_at,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    patientCode: o.patient_code,
    status: o.is_active ? 'active' : 'inactive'
  };
}

function shapeSession(s) {
  if (!s) return null;
  const o = s.toObject ? s.toObject() : s;
  const patient = (o.patient_id && typeof o.patient_id === 'object') ? o.patient_id : null;
  const amb = (o.ambulance_id && typeof o.ambulance_id === 'object') ? o.ambulance_id : null;
  const owner = (o.organization_id && typeof o.organization_id === 'object') ? o.organization_id : null;
  const dest = (o.destination_hospital_id && typeof o.destination_hospital_id === 'object') ? o.destination_hospital_id : null;
  return {
    ...o,
    id: String(o._id || o.id),
    patient_id: patient ? String(patient._id) : (o.patient_id ? String(o.patient_id) : null),
    patient_first_name: patient?.first_name,
    patient_last_name: patient?.last_name,
    ambulance_id: amb ? String(amb._id) : (o.ambulance_id ? String(o.ambulance_id) : null),
    ambulance_code: amb?.ambulance_code,
    registration_number: amb?.registration_number,
    vehicle_model: amb?.vehicle_model,
    vehicle_type: amb?.vehicle_type,
    organization_id: owner ? String(owner._id) : (o.organization_id ? String(o.organization_id) : null),
    organization_name: owner?.name,
    organization_code: owner?.code,
    organization_type: owner?.type,
    destination_hospital_id: dest ? String(dest._id) : (o.destination_hospital_id ? String(o.destination_hospital_id) : null),
    destination_hospital_name: dest?.name
  };
}

function shapeMessage(c) {
  if (!c) return null;
  const o = c.toObject ? c.toObject() : c;
  const sender = (o.sender_id && typeof o.sender_id === 'object') ? o.sender_id : null;
  return {
    ...o,
    id: String(o._id || o.id),
    session_id: String(o.session_id),
    sender_id: sender ? String(sender._id) : (o.sender_id ? String(o.sender_id) : null),
    sender_first_name: sender?.first_name,
    sender_last_name: sender?.last_name,
    sender_role: sender?.role,
    sender_email: sender?.email
  };
}

async function findFullSession(sessionId) {
  return PatientSession.findById(sessionId)
    .populate('patient_id', 'first_name last_name age gender blood_group medical_history allergies current_medications')
    .populate('ambulance_id', 'ambulance_code registration_number vehicle_model vehicle_type organization_id')
    .populate('organization_id', 'name code type')
    .populate('destination_hospital_id', 'name code type')
    .lean();
}

async function attachCrew(session) {
  if (!session || !session.ambulance_id) return session;
  const assignments = await AmbulanceAssignment.find({
    ambulance_id: typeof session.ambulance_id === 'object' ? session.ambulance_id._id : session.ambulance_id,
    is_active: true
  })
    .populate('user_id', 'first_name last_name role email phone')
    .populate('assigning_organization_id', 'name type')
    .lean();

  const crew = assignments.map((a) => ({
    id: a.user_id ? String(a.user_id._id) : null,
    first_name: a.user_id?.first_name,
    last_name: a.user_id?.last_name,
    role: a.user_id?.role,
    email: a.user_id?.email,
    phone: a.user_id?.phone,
    assignment_role: a.role,
    assigned_at: a.assigned_at,
    assigning_organization_id: a.assigning_organization_id ? String(a.assigning_organization_id._id) : null,
    assigning_organization_name: a.assigning_organization_id?.name
  }));

  session.crew = crew;
  session.doctors = crew.filter((c) => c.role && c.role.toLowerCase().includes('doctor'));
  session.paramedics = crew.filter((c) => c.role && c.role.toLowerCase().includes('paramedic'));
  session.drivers = crew.filter((c) => c.role && c.role.toLowerCase().includes('driver'));
  return session;
}

async function userCanAccessSession(req, session) {
  if (!req || !req.user) return false;
  if (req.user.role === 'superadmin') return true;
  if (!session) return false;

  const userOrgId = req.user.organizationId;
  const userOrgType = req.user.organizationType;
  const sessionOwnerOrg = session.organization_id?._id || session.organization_id;
  const sessionDestination = session.destination_hospital_id?._id || session.destination_hospital_id;

  if (sessionOwnerOrg && equalIds(sessionOwnerOrg, userOrgId)) return true;
  if (userOrgType === 'hospital' && sessionDestination && equalIds(sessionDestination, userOrgId)) return true;

  const ambulanceId = session.ambulance_id?._id || session.ambulance_id;
  if (ambulanceId) {
    const assignment = await AmbulanceAssignment.findOne({
      ambulance_id: ambulanceId,
      user_id: req.user.id,
      is_active: true
    }).lean();
    if (assignment) return true;

    if (userOrgType === 'fleet_owner') {
      const amb = await Ambulance.findById(ambulanceId).select('organization_id').lean();
      if (amb && equalIds(amb.organization_id, userOrgId)) return true;
    }
  }
  return false;
}

// Build the offboard metadata snapshot + persist the session/ambulance/patient
// state transitions. `prePopulated` lets the caller hand in a populated
// session it already loaded (e.g. for the access check) so we don't do a
// redundant findFullSession round-trip.
//
// Writes touch three documents (session, ambulance, patient). On a replica
// set we use a Mongo transaction; on standalone Mongo (which doesn't support
// transactions) we fall back to sequential writes ordered most-defensively:
// the session is written first because that's the source of truth for the
// offboard, and ambulance/patient cleanup follows. Failures during cleanup
// are logged but don't undo the session write.
async function offboardSession(session, offboardedBy, treatmentNotes, prePopulated = null) {
  const sessionId = session._id || session.id;

  const full = prePopulated && String(prePopulated._id || prePopulated.id) === String(sessionId)
    ? prePopulated
    : await findFullSession(sessionId);
  if (!full) throw new AppError('Session not found', 404);
  if (!full.crew) await attachCrew(full);

  const ambulanceId = full.ambulance_id?._id || full.ambulance_id;
  const patientId = full.patient_id?._id || full.patient_id;

  const [offUser, onUser, ambulance, sessionDataRows] = await Promise.all([
    User.findById(offboardedBy).select('first_name last_name email role').lean(),
    full.onboarded_by
      ? User.findById(full.onboarded_by).select('first_name last_name email role').lean()
      : Promise.resolve(null),
    ambulanceId
      ? Ambulance.findById(ambulanceId).populate('organization_id').lean()
      : Promise.resolve(null),
    PatientSessionData.find({ session_id: full._id })
      .populate('added_by', 'first_name last_name email role')
      .sort({ added_at: 1 })
      .lean()
  ]);

  const sessionData = (sessionDataRows || []).map((row) => ({
    id: String(row._id),
    dataType: row.data_type,
    content: row.content,
    addedBy: {
      id: row.added_by ? String(row.added_by._id) : null,
      name: row.added_by ? `${row.added_by.first_name ?? ''} ${row.added_by.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown',
      email: row.added_by?.email || null,
      role: row.added_by?.role || null
    },
    addedAt: row.added_at
  }));
  const notes = sessionData.filter((d) => d.dataType === 'note');
  const medications = sessionData.filter((d) => d.dataType === 'medication');
  const files = sessionData.filter((d) => d.dataType === 'file');

  const onboardedAt = full.onboarded_at ? new Date(full.onboarded_at) : null;
  const offboardedAt = new Date();
  const durationMinutes = onboardedAt
    ? Math.max(0, Math.floor((offboardedAt - onboardedAt) / (1000 * 60)))
    : null;

  // Patient snapshot — full.patient_id is populated (object) or null/ObjectId
  // if the patient was deleted before we got here. Guard every field.
  const patientObj = (full.patient_id && typeof full.patient_id === 'object') ? full.patient_id : null;
  const ownerOrg = (full.organization_id && typeof full.organization_id === 'object') ? full.organization_id : null;
  const destOrg = (full.destination_hospital_id && typeof full.destination_hospital_id === 'object') ? full.destination_hospital_id : null;

  const metadata = {
    timeline: {
      onboarded_at: full.onboarded_at,
      offboarded_at: offboardedAt.toISOString(),
      duration_minutes: durationMinutes,
      estimated_arrival_time: full.estimated_arrival_time,
      actual_arrival_time: full.actual_arrival_time
    },
    patient: {
      id: patientObj ? String(patientObj._id) : (patientId ? String(patientId) : null),
      first_name: patientObj?.first_name ?? null,
      last_name: patientObj?.last_name ?? null,
      age: patientObj?.age ?? null,
      gender: patientObj?.gender ?? null,
      blood_group: patientObj?.blood_group ?? null,
      medical_history: patientObj?.medical_history ?? null,
      allergies: patientObj?.allergies ?? null,
      current_medications: patientObj?.current_medications ?? null
    },
    ambulance: {
      id: ambulance ? String(ambulance._id) : (ambulanceId ? String(ambulanceId) : null),
      ambulance_code: ambulance?.ambulance_code ?? null,
      registration_number: ambulance?.registration_number ?? null,
      vehicle_model: ambulance?.vehicle_model ?? null,
      vehicle_type: ambulance?.vehicle_type ?? null,
      owner_organization: ambulance?.organization_id || null
    },
    crew: {
      all_members: full.crew || [],
      doctors: full.doctors || [],
      paramedics: full.paramedics || [],
      drivers: full.drivers || []
    },
    organizations: {
      session_owner: ownerOrg
        ? { id: String(ownerOrg._id), name: ownerOrg.name ?? null, type: ownerOrg.type ?? null }
        : null,
      destination_hospital: destOrg
        ? { id: String(destOrg._id), name: destOrg.name ?? null }
        : null
    },
    locations: {
      pickup: { address: full.pickup_location, latitude: full.pickup_latitude, longitude: full.pickup_longitude },
      destination: { address: full.destination_location, latitude: full.destination_latitude, longitude: full.destination_longitude },
      distance_km: full.distance_km
    },
    medical: {
      chief_complaint: full.chief_complaint,
      initial_assessment: full.initial_assessment,
      treatment_notes: treatmentNotes ?? null,
      outcome_status: full.outcome_status
    },
    session_data: {
      notes,
      medications,
      files,
      total_entries: sessionData.length,
      counts: { notes: notes.length, medications: medications.length, files: files.length }
    },
    users: {
      onboarded_by: {
        id: onUser ? String(onUser._id) : (full.onboarded_by ? String(full.onboarded_by) : null),
        name: onUser ? `${onUser.first_name ?? ''} ${onUser.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown',
        email: onUser?.email ?? null,
        role: onUser?.role ?? null
      },
      offboarded_by: {
        id: offUser ? String(offUser._id) : (offboardedBy ? String(offboardedBy) : null),
        name: offUser ? `${offUser.first_name ?? ''} ${offUser.last_name ?? ''}`.trim() || 'Unknown' : 'Unknown',
        email: offUser?.email ?? null,
        role: offUser?.role ?? null
      }
    },
    identifiers: {
      session_id: String(full._id),
      session_code: full.session_code,
      status: 'offboarded'
    },
    audit: {
      created_at: full.created_at,
      updated_at: full.updated_at,
      offboarded_at: offboardedAt.toISOString(),
      metadata_captured_at: offboardedAt.toISOString()
    }
  };

  const sessionUpdate = {
    status: 'offboarded',
    offboarded_by: offboardedBy,
    offboarded_at: offboardedAt,
    treatment_notes: treatmentNotes ?? null,
    duration_minutes: durationMinutes,
    session_metadata: metadata
  };
  const ambulanceUpdate = { status: 'available', current_hospital_id: null };
  const patientUpdate = { is_onboarded: false, current_session_id: null, onboarded_at: null };

  // Try transactional write first; fall back to sequential writes if the
  // current Mongo deployment doesn't support transactions (standalone).
  const mongoose = require('mongoose');
  let mongoSession = null;
  try {
    mongoSession = await mongoose.startSession();
    await mongoSession.withTransaction(async () => {
      await PatientSession.findByIdAndUpdate(sessionId, sessionUpdate, { session: mongoSession });
      if (ambulanceId) await Ambulance.findByIdAndUpdate(ambulanceId, ambulanceUpdate, { session: mongoSession });
      if (patientId) await Patient.findByIdAndUpdate(patientId, patientUpdate, { session: mongoSession });
    });
  } catch (err) {
    // Transactions require a replica set / mongos. Standalone Mongo throws
    // "Transaction numbers are only allowed on a replica set member or mongos"
    // (error code 20). Fall back to non-transactional writes: session first,
    // then ambulance/patient as best-effort cleanup.
    const isUnsupported = err?.code === 20
      || err?.codeName === 'IllegalOperation'
      || /replica set member|mongos|Transactions are not supported/i.test(err?.message || '');
    if (!isUnsupported) throw err;

    await PatientSession.findByIdAndUpdate(sessionId, sessionUpdate);
    if (ambulanceId) {
      try { await Ambulance.findByIdAndUpdate(ambulanceId, ambulanceUpdate); }
      catch (e) { log.error('offboardSession ambulance update failed', e, { ambulanceId: String(ambulanceId) }); }
    }
    if (patientId) {
      try { await Patient.findByIdAndUpdate(patientId, patientUpdate); }
      catch (e) { log.error('offboardSession patient update failed', e, { patientId: String(patientId) }); }
    }
  } finally {
    if (mongoSession) mongoSession.endSession();
  }

  return {
    sessionId: String(sessionId),
    ambulanceId: ambulanceId ? String(ambulanceId) : null,
    patientId: patientId ? String(patientId) : null,
    ownerOrgId: ownerOrg ? String(ownerOrg._id) : (full.organization_id ? String(full.organization_id) : null),
    destinationOrgId: destOrg ? String(destOrg._id) : (full.destination_hospital_id ? String(full.destination_hospital_id) : null),
    durationMinutes,
    metadata
  };
}

// ---------- controller ----------

class PatientController {
  static async create(req, res, next) {
    try {
      const {
        firstName, lastName, age, gender, bloodGroup, phone, email,
        emergencyContactName, emergencyContactPhone, address,
        medicalHistory, allergies, currentMedications
      } = req.body;

      if (!firstName || !firstName.trim()) return next(new AppError('First name is required', 400));
      if (!req.user || !req.user.id) return next(new AppError('Authentication required to create patient', 401));

      let organizationId = null;
      if (req.user.role === 'superadmin') {
        organizationId = req.body.organizationId || null;
      } else {
        organizationId = req.user.organizationId;
      }

      const patientCode = generateCode('PAT');
      const patient = await Patient.create({
        organization_id: organizationId,
        patient_code: patientCode,
        first_name: firstName,
        last_name: lastName || null,
        age: age || null,
        gender: gender || null,
        blood_group: bloodGroup || null,
        phone: phone || null,
        email: email || null,
        emergency_contact_name: emergencyContactName || null,
        emergency_contact_phone: emergencyContactPhone || null,
        emergency_contact_relation: req.body.emergencyContactRelation || null,
        address: address || null,
        medical_history: medicalHistory || null,
        allergies: allergies || null,
        current_medications: currentMedications || null,
        created_by: req.user.id
      });

      return success(res, 'Patient created successfully', {
        patientId: String(patient._id),
        patientCode
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      const search = req.query.search;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const includeInactive = ['true', '1', 1, true].includes(req.query.includeInactive);

      const filter = {};
      if (!includeInactive) filter.is_active = true;
      if (req.user.role === 'superadmin') {
        if (req.query.organizationId) filter.organization_id = req.query.organizationId;
      } else {
        filter.organization_id = req.user.organizationId;
      }
      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ first_name: re }, { last_name: re }, { patient_code: re }];
      }

      const [docs, total] = await Promise.all([
        Patient.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).lean(),
        Patient.countDocuments(filter)
      ]);

      // Attach latest session status
      const ids = docs.map((p) => p._id);
      const latestSessions = await PatientSession.aggregate([
        { $match: { patient_id: { $in: ids } } },
        { $sort: { created_at: -1 } },
        { $group: { _id: '$patient_id', status: { $first: '$status' } } }
      ]);
      const sessionMap = new Map(latestSessions.map((s) => [String(s._id), s.status]));

      const mapped = docs.map((p) => {
        const mp = mapPatient(p);
        mp.latestSessionStatus = sessionMap.get(String(p._id)) || null;
        return mp;
      });

      return success(res, 'OK', {
        patients: mapped,
        pagination: { total, limit, offset, hasMore: offset + docs.length < total }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getByCode(req, res, next) {
    try {
      const { code } = req.params;
      const patient = await Patient.findOne({ patient_code: code, is_active: true }).lean();
      if (!patient) return next(new AppError('Patient not found', 404));

      if (patient.is_data_hidden &&
          !['hospital_admin', 'hospital_staff', 'fleet_admin', 'fleet_staff', 'superadmin'].includes(req.user.role)) {
        return next(new AppError('Access to this patient data is restricted', 403));
      }

      return success(res, 'OK', { patient: mapPatient(patient) });
    } catch (err) {
      next(err);
    }
  }

  static async getAvailablePatients(req, res, next) {
    try {
      const search = req.query.search;
      const limit = parseInt(req.query.limit, 10) || 100;
      const offset = parseInt(req.query.offset, 10) || 0;

      const filter = { is_onboarded: false, is_active: true };
      if (req.user.role !== 'superadmin') {
        filter.organization_id = req.user.organizationId;
      } else if (req.query.organizationId) {
        filter.organization_id = req.query.organizationId;
      }
      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ first_name: re }, { last_name: re }, { patient_code: re }];
      }

      const docs = await Patient.find(filter)
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      return success(res, 'OK', { patients: docs.map(mapPatient), count: docs.length });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid patient id', 400));

      const patient = await Patient.findById(id);
      if (!patient) return next(new AppError('Patient not found', 404));

      if (req.user.role !== 'superadmin') {
        if (!equalIds(patient.organization_id, req.user.organizationId)) {
          return next(new AppError('Forbidden: cannot edit patient from another organization', 403));
        }
        const roleLower = (req.user.role || '').toString().toLowerCase();
        if (!/(doctor|paramedic|admin)/.test(roleLower)) {
          return next(new AppError('Forbidden: insufficient permissions to edit patient', 403));
        }
      }

      const fieldMap = {
        firstName: 'first_name',
        lastName: 'last_name',
        age: 'age',
        gender: 'gender',
        bloodGroup: 'blood_group',
        phone: 'phone',
        email: 'email',
        emergencyContactName: 'emergency_contact_name',
        emergencyContactPhone: 'emergency_contact_phone',
        emergencyContactRelation: 'emergency_contact_relation',
        address: 'address',
        medicalHistory: 'medical_history',
        allergies: 'allergies',
        currentMedications: 'current_medications'
      };
      for (const [c, s] of Object.entries(fieldMap)) {
        if (req.body[c] !== undefined) patient[s] = req.body[c] || null;
      }
      await patient.save();

      return success(res, 'Patient updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async hideData(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid patient id', 400));
      await Patient.findByIdAndUpdate(id, {
        is_data_hidden: true,
        hidden_by: req.user.id,
        hidden_at: new Date()
      });
      return success(res, 'Patient data hidden successfully');
    } catch (err) {
      next(err);
    }
  }

  static async unhideData(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid patient id', 400));
      await Patient.findByIdAndUpdate(id, {
        is_data_hidden: false,
        hidden_by: null,
        hidden_at: null
      });
      return success(res, 'Patient data unhidden successfully');
    } catch (err) {
      next(err);
    }
  }

  static async onboard(req, res, next) {
    try {
      const { patientId } = req.params;
      const {
        ambulanceId,
        pickupLocation, pickupLatitude, pickupLongitude,
        destinationLocation, destinationLatitude, destinationLongitude,
        destinationHospitalId, chiefComplaint, initialAssessment
      } = req.body;

      if (!req.user || !req.user.organizationId) {
        return next(new AppError('Unauthorized: User organization not found', 403));
      }
      if (!ambulanceId || !isValidId(ambulanceId)) return next(new AppError('Ambulance ID is required', 400));
      if (!isValidId(patientId)) return next(new AppError('Invalid patient id', 400));

      const userOrgType = req.user.organizationType || 'hospital';

      const ambulance = await Ambulance.findById(ambulanceId);
      if (!ambulance) return next(new AppError('Ambulance not found', 404));
      if (!['available'].includes(ambulance.status)) {
        return next(new AppError(
          `Cannot onboard patient: Ambulance status is '${ambulance.status}'. Only 'available' ambulances can accept new patients.`,
          400
        ));
      }

      const activeAmbSession = await PatientSession.findOne({
        ambulance_id: ambulanceId,
        status: { $in: ACTIVE_SESSION_STATUSES }
      }).lean();
      if (activeAmbSession) return next(new AppError('Ambulance already has an active patient session', 400));

      const patient = await Patient.findById(patientId);
      if (!patient) return next(new AppError('Patient not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(patient.organization_id, req.user.organizationId)) {
        return next(new AppError('Unauthorized: You can only onboard patients from your organization', 403));
      }
      if (!patient.is_active) {
        return next(new AppError('Cannot onboard inactive patient', 400));
      }

      const patientActive = await PatientSession.findOne({
        patient_id: patientId,
        status: { $in: ACTIVE_SESSION_STATUSES }
      }).lean();
      if (patientActive) {
        return next(new AppError('Patient already has an active session. Offboard the current session first.', 400));
      }

      // Ambulance ownership / partnership validation
      if (req.user.role !== 'superadmin') {
        if (userOrgType === 'fleet_owner') {
          if (!equalIds(ambulance.organization_id, req.user.organizationId)) {
            return next(new AppError('Unauthorized: You can only use ambulances from your fleet', 403));
          }
        } else if (userOrgType === 'hospital') {
          if (!equalIds(ambulance.organization_id, req.user.organizationId)) {
            const partnership = await Partnership.findOne({
              fleet_id: ambulance.organization_id,
              hospital_id: req.user.organizationId,
              status: 'active'
            });
            if (!partnership) {
              return next(new AppError("Unauthorized: No active partnership with this ambulance's fleet", 403));
            }
          }
        }
      }

      const sessionCode = generateCode('SES');
      const session = await PatientSession.create({
        session_code: sessionCode,
        patient_id: patientId,
        ambulance_id: ambulanceId,
        organization_id: req.user.organizationId,
        destination_hospital_id: destinationHospitalId || req.user.organizationId,
        pickup_location: pickupLocation || 'Current Location',
        pickup_latitude: pickupLatitude ?? 0,
        pickup_longitude: pickupLongitude ?? 0,
        destination_location: destinationLocation || 'Hospital',
        destination_latitude: destinationLatitude ?? 0,
        destination_longitude: destinationLongitude ?? 0,
        chief_complaint: chiefComplaint || null,
        initial_assessment: initialAssessment || null,
        onboarded_by: req.user.id,
        status: 'onboarded'
      });

      ambulance.status = 'active';
      ambulance.current_hospital_id = req.user.organizationId;
      await ambulance.save();

      patient.is_onboarded = true;
      patient.current_session_id = session._id;
      patient.onboarded_at = new Date();
      await patient.save();

      // Cross-org sync: create a partner copy of the patient
      try {
        if (userOrgType === 'hospital' && !equalIds(ambulance.organization_id, req.user.organizationId)) {
          const exists = await Patient.findOne({
            first_name: patient.first_name,
            last_name: patient.last_name,
            organization_id: ambulance.organization_id
          });
          if (!exists) {
            await Patient.create({
              organization_id: ambulance.organization_id,
              patient_code: `${patient.patient_code}-FLEET`,
              first_name: patient.first_name,
              last_name: patient.last_name,
              age: patient.age,
              gender: patient.gender,
              blood_group: patient.blood_group,
              phone: patient.phone,
              emergency_contact_name: patient.emergency_contact_name,
              emergency_contact_phone: patient.emergency_contact_phone,
              emergency_contact_relation: patient.emergency_contact_relation,
              address: patient.address,
              medical_history: patient.medical_history,
              allergies: patient.allergies,
              current_medications: patient.current_medications,
              created_by: req.user.id
            });
          }
        }
        if (userOrgType === 'fleet_owner' && destinationHospitalId && !equalIds(destinationHospitalId, req.user.organizationId)) {
          const exists = await Patient.findOne({
            first_name: patient.first_name,
            last_name: patient.last_name,
            organization_id: destinationHospitalId
          });
          if (!exists) {
            await Patient.create({
              organization_id: destinationHospitalId,
              patient_code: `${patient.patient_code}-HOSP`,
              first_name: patient.first_name,
              last_name: patient.last_name,
              age: patient.age,
              gender: patient.gender,
              blood_group: patient.blood_group,
              phone: patient.phone,
              emergency_contact_name: patient.emergency_contact_name,
              emergency_contact_phone: patient.emergency_contact_phone,
              emergency_contact_relation: patient.emergency_contact_relation,
              address: patient.address,
              medical_history: patient.medical_history,
              allergies: patient.allergies,
              current_medications: patient.current_medications,
              created_by: req.user.id
            });
          }
        }
      } catch (e) {
        log.warn('cross-org patient sync failed', { msg: e.message });
      }

      // socket + notifications
      const io = req.app.get('io');
      if (io) io.to(`ambulance_${ambulanceId}`).emit('patient_onboarded', { sessionId: String(session._id), sessionCode });

      try {
        await NotificationService.notifyAmbulanceCrewPatientOnboarded(ambulanceId, {
          sessionId: String(session._id),
          sessionCode,
          patientId: String(patient._id),
          firstName: patient.first_name,
          lastName: patient.last_name
        });
      } catch (e) {
        log.warn('failed to notify ambulance crew', { msg: e.message });
      }

      return success(res, 'Patient onboarded successfully', {
        sessionId: String(session._id),
        sessionCode
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async offboard(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { treatmentNotes } = req.body;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));

      // Load the populated session once and reuse it for the access check
      // and for the metadata snapshot. Avoids the duplicate findFullSession
      // we used to do here + inside offboardSession.
      const populated = await findFullSession(sessionId);
      if (!populated) return next(new AppError('Session not found', 404));
      if (populated.status === 'offboarded') return next(new AppError('Patient already offboarded', 400));

      const allowed = await userCanAccessSession(req, populated);
      if (!allowed) return next(new AppError('You do not have permission to offboard this session', 403));

      const result = await offboardSession({ _id: sessionId }, req.user.id, treatmentNotes, populated);

      // Activity log — non-blocking, fire-and-forget so a logger failure
      // doesn't block the response.
      ActivityLogService.log({
        activity: ACTIVITY_TYPES.PATIENT_OFFBOARDED,
        comments: `Patient offboarded from session ${populated.session_code || sessionId}`,
        user: req.user,
        organization: { id: result.ownerOrgId, name: populated.organization_id?.name },
        metadata: {
          sessionId: result.sessionId,
          sessionCode: populated.session_code,
          ambulanceId: result.ambulanceId,
          patientId: result.patientId,
          durationMinutes: result.durationMinutes,
          destinationHospitalId: result.destinationOrgId
        },
        req
      }).catch((e) => log.warn('offboard activity log failed', { msg: e.message }));

      const io = req.app.get('io');
      if (io) {
        const endedPayload = {
          sessionId,
          status: 'offboarded',
          message: 'This session has been ended',
          timestamp: new Date().toISOString()
        };
        if (result.ambulanceId) io.to(`ambulance_${result.ambulanceId}`).emit('patient_offboarded', { sessionId });
        io.to(`session_${sessionId}`).emit('session_offboarded', { sessionId });
        io.to(`session_${sessionId}`).emit('session_ended', endedPayload);
        // Broadcast to org rooms so any user watching the sessions list can
        // refresh without having joined the per-session room.
        if (result.ownerOrgId) io.to(`org_${result.ownerOrgId}`).emit('session_offboarded', { sessionId });
        if (result.destinationOrgId && result.destinationOrgId !== result.ownerOrgId) {
          io.to(`org_${result.destinationOrgId}`).emit('session_offboarded', { sessionId });
        }
      }

      return success(res, 'Patient offboarded successfully', {
        sessionId: result.sessionId,
        durationMinutes: result.durationMinutes
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));

      const populated = await findFullSession(sessionId);
      if (!populated) return next(new AppError('Session not found', 404));
      const allowed = await userCanAccessSession(req, populated);
      if (!allowed) return next(new AppError('You do not have access to this session', 403));

      await attachCrew(populated);

      // Filter crew visibility per the original behavior
      if (req.user.role !== 'superadmin' && populated.crew?.length > 0) {
        const ambulanceFleetId = populated.ambulance_id?.organization_id
          ? String(populated.ambulance_id.organization_id)
          : null;
        let allowedOrgIds = [String(req.user.organizationId)];
        if (req.user.organizationType === 'hospital' && ambulanceFleetId) allowedOrgIds.push(ambulanceFleetId);
        else if (req.user.organizationType === 'fleet_owner' && populated.destination_hospital_id) {
          allowedOrgIds.push(String(populated.destination_hospital_id._id || populated.destination_hospital_id));
        }
        const filterFn = (crew) => crew.filter((m) => allowedOrgIds.includes(String(m.assigning_organization_id)));
        populated.crew = filterFn(populated.crew);
        populated.doctors = filterFn(populated.doctors || []);
        populated.paramedics = filterFn(populated.paramedics || []);
        populated.drivers = filterFn(populated.drivers || []);
      }

      const [vitals, communications] = await Promise.all([
        VitalSign.find({ session_id: sessionId }).sort({ recorded_at: -1 }).limit(20).lean(),
        Communication.find({ session_id: sessionId })
          .populate('sender_id', 'first_name last_name role email')
          .sort({ created_at: 1 })
          .lean()
      ]);

      return success(res, 'OK', {
        session: shapeSession(populated),
        vitals,
        communications: communications.map(shapeMessage)
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSessions(req, res, next) {
    try {
      const { status, ambulanceId } = req.query;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;

      // Special-case: caller asks for the single latest session of an ambulance.
      // `hasSession` is scoped to *active* sessions only — an offboarded
      // session in this ambulance's history is "no longer there" from the
      // caller's perspective. Previously this returned hasSession=true for
      // any session in history, which made the mobile/web ambulance UI
      // treat an offboarded vehicle as still occupied.
      if (ambulanceId && limit === 1) {
        if (!isValidId(ambulanceId)) return next(new AppError('Invalid ambulance id', 400));
        const latestActive = await PatientSession.findOne({
          ambulance_id: ambulanceId,
          status: { $in: ACTIVE_SESSION_STATUSES }
        })
          .sort({ created_at: -1 })
          .lean();
        if (!latestActive) {
          return success(res, 'OK', {
            sessions: [],
            pagination: { total: 0, limit: 1, offset: 0, hasMore: false },
            hasSession: false
          });
        }
        const populated = await findFullSession(latestActive._id);
        const allowed = await userCanAccessSession(req, populated);
        if (allowed) {
          await attachCrew(populated);
          return success(res, 'OK', {
            sessions: [shapeSession(populated)],
            pagination: { total: 1, limit: 1, offset: 0, hasMore: false },
            hasSession: true
          });
        }
        // Active session exists but the caller can't see it (e.g. hospital
        // user looking at a fleet-owned vehicle on an unrelated run).
        return success(res, 'OK', {
          sessions: [],
          pagination: { total: 0, limit: 1, offset: 0, hasMore: false },
          hasSession: true
        });
      }

      const filter = {};
      if (ambulanceId) filter.ambulance_id = ambulanceId;
      if (status) {
        if (status === 'active') filter.status = { $in: ACTIVE_SESSION_STATUSES };
        else filter.status = status;
      }

      if (req.user.role !== 'superadmin') {
        let bypassOrgScope = false;
        if (ambulanceId) {
          const assigned = await AmbulanceAssignment.findOne({
            ambulance_id: ambulanceId,
            user_id: req.user.id,
            is_active: true
          }).lean();
          if (assigned) bypassOrgScope = true;
          else if (req.user.organizationType === 'fleet_owner') {
            const amb = await Ambulance.findById(ambulanceId).select('organization_id').lean();
            if (amb && equalIds(amb.organization_id, req.user.organizationId)) bypassOrgScope = true;
          }
        }

        if (!bypassOrgScope) {
          if (req.user.organizationType === 'hospital') {
            filter.$or = [
              { organization_id: req.user.organizationId },
              { destination_hospital_id: req.user.organizationId }
            ];
          } else if (req.user.organizationType === 'fleet_owner') {
            const ambIds = await Ambulance.find({ organization_id: req.user.organizationId }).distinct('_id');
            filter.$or = [
              { organization_id: req.user.organizationId },
              { ambulance_id: { $in: ambIds } }
            ];
          } else {
            filter.organization_id = req.user.organizationId;
          }
        }
      }

      const [docs, total] = await Promise.all([
        PatientSession.find(filter)
          .sort({ created_at: -1 })
          .skip(offset)
          .limit(limit)
          .populate('patient_id', 'first_name last_name')
          .populate('ambulance_id', 'ambulance_code registration_number organization_id')
          .populate('organization_id', 'name code type')
          .populate('destination_hospital_id', 'name')
          .lean(),
        PatientSession.countDocuments(filter)
      ]);

      // Attach crew per session
      for (const s of docs) await attachCrew(s);

      // Final defensive access filter
      let sessions = docs;
      if (req.user.role !== 'superadmin') {
        const filtered = [];
        for (const s of sessions) {
          if (await userCanAccessSession(req, s)) filtered.push(s);
        }
        sessions = filtered;
      }

      return success(res, 'OK', {
        sessions: sessions.map(shapeSession),
        pagination: { total, limit, offset, hasMore: offset + sessions.length < total }
      });
    } catch (err) {
      next(err);
    }
  }

  static async addVitalSigns(req, res, next) {
    try {
      const { patientId } = req.params;
      if (!isValidId(patientId)) return next(new AppError('Invalid patient id', 400));

      const session = await PatientSession.findOne({
        patient_id: patientId,
        status: { $in: ACTIVE_SESSION_STATUSES }
      });
      if (!session) return next(new AppError('No active session found for this patient', 404));

      const payload = {
        patient_id: patientId,
        session_id: session._id,
        recorded_by: req.user.id,
        heart_rate: req.body.heartRate,
        blood_pressure_systolic: req.body.bloodPressureSystolic,
        blood_pressure_diastolic: req.body.bloodPressureDiastolic,
        temperature: req.body.temperature,
        respiratory_rate: req.body.respiratoryRate,
        oxygen_saturation: req.body.oxygenSaturation,
        blood_glucose: req.body.bloodGlucose,
        consciousness_level: req.body.consciousnessLevel,
        pain_scale: req.body.painScale,
        notes: req.body.notes
      };
      const vital = await VitalSign.create(payload);

      const io = req.app.get('io');
      if (io) {
        io.to(`session_${session._id}`).emit('vital_update', {
          vitalId: String(vital._id),
          sessionId: String(session._id),
          ...payload
        });
      }

      return success(res, 'Vital signs added successfully', { vitalId: String(vital._id) }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getVitalSigns(req, res, next) {
    try {
      const { patientId } = req.params;
      if (!isValidId(patientId)) return next(new AppError('Invalid patient id', 400));
      const limit = parseInt(req.query.limit, 10) || 20;

      const session = await PatientSession.findOne({
        patient_id: patientId,
        status: { $in: ACTIVE_SESSION_STATUSES }
      });
      if (!session) return next(new AppError('No active session found for this patient', 404));

      const vitals = await VitalSign.find({ session_id: session._id })
        .sort({ recorded_at: -1 })
        .limit(limit)
        .lean();
      return success(res, 'OK', { vitalSigns: vitals, sessionId: String(session._id) });
    } catch (err) {
      next(err);
    }
  }

  static async addCommunication(req, res, next) {
    try {
      const { patientId } = req.params;
      if (!isValidId(patientId)) return next(new AppError('Invalid patient id', 400));
      const { messageType, message, metadata } = req.body;

      const session = await PatientSession.findOne({
        patient_id: patientId,
        status: { $in: ACTIVE_SESSION_STATUSES }
      });
      if (!session) return next(new AppError('No active session found for this patient', 404));

      const allowed = await userCanAccessSession(req, session);
      if (!allowed) return next(new AppError('Access denied to this session', 403));

      const comm = await Communication.create({
        session_id: session._id,
        sender_id: req.user.id,
        message_type: messageType || 'text',
        message,
        metadata
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`session_${session._id}`).emit('new_message', {
          id: String(comm._id),
          senderId: req.user.id,
          senderName: `${req.user.firstName} ${req.user.lastName}`,
          senderRole: req.user.role,
          message,
          messageType: messageType || 'text',
          metadata,
          createdAt: comm.created_at
        });
      }

      return success(res, 'Message sent successfully', { communicationId: String(comm._id) }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getPatientSessions(req, res, next) {
    try {
      const { patientId } = req.params;
      if (!isValidId(patientId)) return next(new AppError('Invalid patient id', 400));

      const patient = await Patient.findById(patientId).lean();
      if (!patient) return next(new AppError('Patient not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(patient.organization_id, req.user.organizationId)) {
        return next(new AppError('Access denied to patient sessions', 403));
      }

      const sessions = await PatientSession.find({ patient_id: patientId })
        .sort({ created_at: -1 })
        .populate('patient_id', 'first_name last_name')
        .populate('ambulance_id', 'ambulance_code registration_number vehicle_model vehicle_type')
        .populate('organization_id', 'name type')
        .populate('destination_hospital_id', 'name')
        .lean();
      for (const s of sessions) await attachCrew(s);

      return success(res, 'OK', sessions.map(shapeSession));
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid patient id', 400));

      const patient = await Patient.findById(id);
      if (!patient) return next(new AppError('Patient not found', 404));

      const activeSession = await PatientSession.findOne({
        patient_id: id,
        status: { $in: ACTIVE_SESSION_STATUSES }
      });
      if (activeSession) {
        // offboardSession now handles ambulance + patient cleanup itself, so
        // we don't need the extra ambulance update that used to live here.
        const result = await offboardSession(
          activeSession,
          req.user.id,
          'Auto-offboarded: patient deactivated'
        );
        const io = req.app.get('io');
        if (io) {
          const sid = String(activeSession._id);
          if (result.ambulanceId) io.to(`ambulance_${result.ambulanceId}`).emit('patient_offboarded', { sessionId: sid });
          io.to(`session_${sid}`).emit('session_offboarded', { sessionId: sid });
          io.to(`session_${sid}`).emit('session_ended', {
            sessionId: sid,
            status: 'offboarded',
            message: 'This session has been ended',
            timestamp: new Date().toISOString()
          });
          if (result.ownerOrgId) io.to(`org_${result.ownerOrgId}`).emit('session_offboarded', { sessionId: sid });
          if (result.destinationOrgId && result.destinationOrgId !== result.ownerOrgId) {
            io.to(`org_${result.destinationOrgId}`).emit('session_offboarded', { sessionId: sid });
          }
        }
      }

      patient.is_active = false;
      await patient.save();

      return success(res, 'Patient deactivated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async activate(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid patient id', 400));
      const patient = await Patient.findById(id);
      if (!patient) return next(new AppError('Patient not found', 404));
      patient.is_active = true;
      await patient.save();
      return success(res, 'Patient activated successfully');
    } catch (err) {
      next(err);
    }
  }

  // ----- session messages -----

  static async getSessionMessages(req, res, next) {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));
      const limit = parseInt(req.query.limit, 10) || 100;

      const session = await PatientSession.findById(sessionId).lean();
      if (!session) return next(new AppError('Session not found', 404));
      const allowed = await userCanAccessSession(req, session);
      if (!allowed) return next(new AppError('Access denied to this session', 403));

      const messages = await Communication.find({ session_id: sessionId })
        .populate('sender_id', 'first_name last_name role email')
        .sort({ created_at: 1 })
        .limit(limit)
        .lean();

      return success(res, 'OK', { messages: messages.map(shapeMessage) });
    } catch (err) {
      next(err);
    }
  }

  static async sendSessionMessage(req, res, next) {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));
      const { messageType, message, metadata } = req.body;

      const session = await PatientSession.findById(sessionId);
      if (!session) return next(new AppError('Session not found', 404));
      const allowed = await userCanAccessSession(req, session);
      if (!allowed) return next(new AppError('Access denied to this session', 403));

      const comm = await Communication.create({
        session_id: sessionId,
        sender_id: req.user.id,
        message_type: messageType || 'text',
        message,
        metadata
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`session_${sessionId}`).emit('new_message', {
          id: String(comm._id),
          sessionId,
          senderId: req.user.id,
          senderFirstName: req.user.firstName,
          senderLastName: req.user.lastName,
          senderRole: req.user.role,
          senderEmail: req.user.email,
          message,
          messageType: messageType || 'text',
          metadata,
          createdAt: comm.created_at
        });
      }

      // Notifications for offline users with session access
      try {
        const usersToNotify = new Set();

        const ambCrew = await AmbulanceAssignment.find({
          ambulance_id: session.ambulance_id,
          is_active: true
        }).select('user_id').lean();
        for (const c of ambCrew) usersToNotify.add(String(c.user_id));

        if (session.destination_hospital_id) {
          const hospStaff = await User.find({
            organization_id: session.destination_hospital_id,
            role: { $in: ['hospital_admin', 'hospital_doctor', 'hospital_paramedic'] },
            status: 'active'
          }).select('_id').lean();
          for (const u of hospStaff) usersToNotify.add(String(u._id));
        }

        if (session.organization_id) {
          const orgUsers = await User.find({
            organization_id: session.organization_id,
            status: 'active'
          }).select('_id').lean();
          for (const u of orgUsers) usersToNotify.add(String(u._id));
        }

        usersToNotify.delete(String(req.user.id));

        const sessionRoom = io && io.sockets.adapter.rooms.get(`session_${sessionId}`);
        const connectedIds = new Set();
        if (sessionRoom) {
          for (const socketId of sessionRoom) {
            const s = io.sockets.sockets.get(socketId);
            if (s?.user?.id) connectedIds.add(String(s.user.id));
          }
        }

        const targets = [...usersToNotify].filter((id) => !connectedIds.has(id));
        if (targets.length > 0) {
          const preview = (message || '').substring(0, 50);
          const notifications = targets.map((userId) => ({
            userId,
            type: 'new_message',
            title: 'New Message',
            message: `${req.user.firstName} ${req.user.lastName}: ${preview}${(message || '').length > 50 ? '...' : ''}`,
            data: {
              sessionId,
              messageId: String(comm._id),
              senderId: req.user.id,
              senderName: `${req.user.firstName} ${req.user.lastName}`
            }
          }));
          await NotificationService.createBulkNotifications(notifications);
        }
      } catch (e) {
        log.warn('sendSessionMessage notification error', { msg: e.message });
      }

      return success(res, 'Message sent successfully', {
        id: String(comm._id),
        sessionId,
        message,
        messageType: messageType || 'text'
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async markMessageAsRead(req, res, next) {
    try {
      const { messageId } = req.params;
      if (!isValidId(messageId)) return next(new AppError('Invalid message id', 400));

      const message = await Communication.findById(messageId);
      if (!message) return next(new AppError('Message not found', 404));

      if (!message.read_by) message.read_by = [];
      const already = message.read_by.some((id) => equalIds(id, req.user.id));
      if (!already) {
        message.read_by.push(req.user.id);
        await message.save();
      }
      return success(res, 'Message marked as read');
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(req, res, next) {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));
      const session = await PatientSession.findById(sessionId).lean();
      if (!session) return next(new AppError('Session not found', 404));
      const allowed = await userCanAccessSession(req, session);
      if (!allowed) return next(new AppError('Access denied to this session', 403));

      const count = await Communication.countDocuments({
        session_id: sessionId,
        sender_id: { $ne: req.user.id },
        read_by: { $ne: req.user.id }
      });
      return success(res, 'OK', { unreadCount: count });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PatientController;
// Exposed so other controllers (ambulance maintenance / deactivation) can
// reuse the metadata-capturing offboard path instead of issuing raw
// updateMany calls that lose the snapshot, duration, and patient cleanup.
module.exports.offboardSession = offboardSession;
