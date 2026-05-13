const { PatientSession, Organization, Ambulance } = require('../models');
const { AppError } = require('../middleware/auth');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');

function shapeSession(s) {
  if (!s) return null;
  const o = s.toObject ? s.toObject() : s;
  const patient = (o.patient_id && typeof o.patient_id === 'object') ? o.patient_id : null;
  const amb = (o.ambulance_id && typeof o.ambulance_id === 'object') ? o.ambulance_id : null;
  const owner = (o.organization_id && typeof o.organization_id === 'object') ? o.organization_id : null;
  const dest = (o.destination_hospital_id && typeof o.destination_hospital_id === 'object') ? o.destination_hospital_id : null;
  const onUser = (o.onboarded_by && typeof o.onboarded_by === 'object') ? o.onboarded_by : null;
  const offUser = (o.offboarded_by && typeof o.offboarded_by === 'object') ? o.offboarded_by : null;
  return {
    ...o,
    id: String(o._id || o.id),
    patient_id: patient ? String(patient._id) : (o.patient_id ? String(o.patient_id) : null),
    patient_first_name: patient?.first_name,
    patient_last_name: patient?.last_name,
    ambulance_id: amb ? String(amb._id) : (o.ambulance_id ? String(o.ambulance_id) : null),
    ambulance_code: amb?.ambulance_code,
    registration_number: amb?.registration_number,
    organization_id: owner ? String(owner._id) : (o.organization_id ? String(o.organization_id) : null),
    organization_name: owner?.name,
    organization_type: owner?.type,
    destination_hospital_id: dest ? String(dest._id) : (o.destination_hospital_id ? String(o.destination_hospital_id) : null),
    destination_hospital_name: dest?.name,
    onboarded_by_first_name: onUser?.first_name,
    onboarded_by_last_name: onUser?.last_name,
    offboarded_by_first_name: offUser?.first_name,
    offboarded_by_last_name: offUser?.last_name,
    metadata: o.session_metadata || null
  };
}

class SessionController {
  static async getAllSessions(req, res, next) {
    try {
      const { status, search, startDate, endDate, organizationId } = req.query;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = (page - 1) * limit;

      // Org scoping
      let orgIdToScope = null;
      let orgType = null;
      if (req.user.role === 'superadmin') {
        if (!organizationId) {
          return next(new AppError('organizationId is required when superadmin is viewing sessions', 400));
        }
        if (!isValidId(organizationId)) return next(new AppError('Invalid organizationId', 400));
        orgIdToScope = organizationId;
        const org = await Organization.findById(organizationId).select('type').lean();
        orgType = org?.type;
      } else {
        orgIdToScope = req.user.organizationId;
        orgType = req.user.organizationType;
      }

      const filter = {};
      if (status) filter.status = status;

      if (orgIdToScope) {
        if (orgType === 'fleet_owner') {
          const fleetAmbIds = await Ambulance.find({ organization_id: orgIdToScope }).distinct('_id');
          filter.$or = [{ organization_id: orgIdToScope }, { ambulance_id: { $in: fleetAmbIds } }];
        } else if (orgType === 'hospital') {
          // Hospitals should see sessions both when they are the owner AND
          // when they're only the destination_hospital (e.g. a partner fleet
          // onboarded a patient bound for this hospital). The old code only
          // matched on organization_id, which hid those sessions from the
          // history list. Matches the patient-routes /sessions scoping.
          filter.$or = [
            { organization_id: orgIdToScope },
            { destination_hospital_id: orgIdToScope }
          ];
        } else {
          filter.organization_id = orgIdToScope;
        }
      }

      if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.session_code = re;
      }
      if (startDate) filter.onboarded_at = { ...(filter.onboarded_at || {}), $gte: new Date(startDate) };
      if (endDate) filter.onboarded_at = { ...(filter.onboarded_at || {}), $lte: new Date(endDate) };

      const [docs, total] = await Promise.all([
        PatientSession.find(filter)
          .sort({ onboarded_at: -1 })
          .skip(offset)
          .limit(limit)
          .populate('patient_id', 'first_name last_name')
          .populate('ambulance_id', 'ambulance_code registration_number')
          .populate('organization_id', 'name type')
          .populate('destination_hospital_id', 'name')
          .populate('onboarded_by', 'first_name last_name')
          .populate('offboarded_by', 'first_name last_name')
          .lean(),
        PatientSession.countDocuments(filter)
      ]);

      return success(res, 'OK', {
        sessions: docs.map(shapeSession),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSessionMetadata(req, res, next) {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));

      const session = await PatientSession.findById(sessionId)
        .populate('patient_id', 'first_name last_name')
        .populate({
          path: 'ambulance_id',
          select: 'ambulance_code registration_number organization_id'
        })
        .populate('organization_id', 'name type')
        .populate('destination_hospital_id', 'name')
        .lean();
      if (!session) return next(new AppError('Session not found', 404));

      if (req.user.role !== 'superadmin') {
        const ambOwner = session.ambulance_id?.organization_id;
        const hasAccess =
          equalIds(session.organization_id?._id || session.organization_id, req.user.organizationId) ||
          equalIds(session.destination_hospital_id?._id || session.destination_hospital_id, req.user.organizationId) ||
          (req.user.organizationType === 'fleet_owner' && equalIds(ambOwner, req.user.organizationId));
        if (!hasAccess) return next(new AppError('You do not have access to this session', 403));
      }

      return success(res, 'OK', { session: shapeSession(session) });
    } catch (err) {
      next(err);
    }
  }

  static async getSessionStats(req, res, next) {
    try {
      let orgIdToScope = null;
      let orgType = null;

      if (req.user.role === 'superadmin') {
        const { organizationId } = req.query;
        if (!organizationId) return next(new AppError('organizationId is required when superadmin is viewing session stats', 400));
        if (!isValidId(organizationId)) return next(new AppError('Invalid organizationId', 400));
        orgIdToScope = organizationId;
        const org = await Organization.findById(organizationId).select('type').lean();
        orgType = org?.type;
      } else {
        orgIdToScope = req.user.organizationId;
        orgType = req.user.organizationType;
      }

      const filter = {};
      if (orgType === 'fleet_owner') {
        const ambIds = await Ambulance.find({ organization_id: orgIdToScope }).distinct('_id');
        filter.$or = [{ organization_id: orgIdToScope }, { ambulance_id: { $in: ambIds } }];
      } else if (orgType === 'hospital') {
        filter.$or = [
          { organization_id: orgIdToScope },
          { destination_hospital_id: orgIdToScope }
        ];
      } else {
        filter.organization_id = orgIdToScope;
      }

      const agg = await PatientSession.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            total_sessions: { $sum: 1 },
            onboarded: { $sum: { $cond: [{ $eq: ['$status', 'onboarded'] }, 1, 0] } },
            in_transit: { $sum: { $cond: [{ $eq: ['$status', 'in_transit'] }, 1, 0] } },
            offboarded: { $sum: { $cond: [{ $eq: ['$status', 'offboarded'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            avg_duration_minutes: { $avg: '$duration_minutes' }
          }
        }
      ]);

      const stats = agg[0] || {
        total_sessions: 0, onboarded: 0, in_transit: 0, offboarded: 0, cancelled: 0, avg_duration_minutes: null
      };
      delete stats._id;

      return success(res, 'OK', { stats });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SessionController;
