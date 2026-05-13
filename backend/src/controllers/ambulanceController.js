const {
  Ambulance,
  AmbulanceAssignment,
  Organization,
  Partnership,
  PatientSession,
  User
} = require('../models');
const { AppError } = require('../middleware/auth');
const NotificationService = require('../services/notificationService');
const ActivityLogService = require('../services/activityLogService');
const { success } = require('../utils/response');
const { isValidId, equalIds, toObjectId } = require('../utils/ids');
const { isMedicalStaff } = require('../config/permissions');
const { generateCode } = require('../utils/codes');

// --- helpers ---

function populateAmbulance(query) {
  return query
    .populate('organization_id', 'name code type')
    .populate('current_hospital_id', 'name code type');
}

function shapeAmbulance(amb) {
  if (!amb) return null;
  const a = amb.toObject ? amb.toObject() : amb;
  const org = a.organization_id && typeof a.organization_id === 'object' ? a.organization_id : null;
  const hospital = a.current_hospital_id && typeof a.current_hospital_id === 'object' ? a.current_hospital_id : null;

  return {
    ...a,
    id: String(a._id || a.id),
    organization_id: org ? String(org._id || org.id) : (a.organization_id ? String(a.organization_id) : null),
    organizationId: org ? String(org._id || org.id) : (a.organization_id ? String(a.organization_id) : null),
    organization_name: org?.name,
    organization_code: org?.code,
    organization_type: org?.type,
    current_hospital_id: hospital ? String(hospital._id || hospital.id) : (a.current_hospital_id ? String(a.current_hospital_id) : null),
    currentHospitalId: hospital ? String(hospital._id || hospital.id) : (a.current_hospital_id ? String(a.current_hospital_id) : null),
    current_hospital_name: hospital?.name
  };
}

async function findAmbulancesAssignedToUser(userId) {
  const assignments = await AmbulanceAssignment.find({ user_id: userId, is_active: true }).select('ambulance_id').lean();
  const ids = assignments.map((a) => a.ambulance_id);
  if (ids.length === 0) return [];
  const query = Ambulance.find({
    _id: { $in: ids },
    status: { $in: ['active', 'available', 'onboarded', 'in_transit', 'on_trip'] }
  });
  const docs = await populateAmbulance(query).lean();
  return docs.map(shapeAmbulance);
}

// --- controller ---

class AmbulanceController {
  static async create(req, res, next) {
    try {
      const { vehicleNumber, vehicleModel, vehicleType } = req.body;

      const ambulanceCode = generateCode('AMB');

      const organizationId = req.user.role === 'superadmin'
        ? req.body.organizationId
        : req.user.organizationId;

      if (!isValidId(organizationId)) {
        return next(new AppError('Valid organizationId is required', 400));
      }

      const amb = await Ambulance.create({
        organization_id: organizationId,
        ambulance_code: ambulanceCode,
        registration_number: vehicleNumber,
        vehicle_model: vehicleModel,
        vehicle_type: vehicleType,
        status: 'pending_approval',
        created_by: req.user.id
      });

      try {
        const org = await Organization.findById(organizationId).select('name').lean();
        await NotificationService.notifySuperadminsNewAmbulance({
          id: String(amb._id),
          ambulance_code: ambulanceCode,
          organizationName: org?.name
        });
      } catch (e) {
        console.error('Failed to send new-ambulance notification:', e.message);
      }

      return success(res, 'Ambulance created successfully. Awaiting approval.', {
        ambulanceId: String(amb._id)
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      const { status } = req.query;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;

      // Medical staff: only see ambulances assigned to them
      if (isMedicalStaff(req.user.role)) {
        let assigned = await findAmbulancesAssignedToUser(req.user.id);
        if (status) assigned = assigned.filter((a) => a.status === status);

        if (req.query.partnered === 'true') {
          let hospitalIdForPartnered = null;
          if (req.user.organizationType === 'hospital') hospitalIdForPartnered = req.user.organizationId;

          if (hospitalIdForPartnered) {
            const partnerships = await Partnership.find({
              hospital_id: hospitalIdForPartnered,
              status: 'active'
            }).select('fleet_id').lean();
            const partneredFleetIds = partnerships.map((p) => String(p.fleet_id));
            assigned = assigned.filter((a) => partneredFleetIds.includes(String(a.organization_id)));
          }
        } else {
          assigned = assigned.filter((a) => equalIds(a.organization_id, req.user.organizationId));
        }

        return success(res, 'OK', {
          ambulances: assigned,
          pagination: { total: assigned.length, limit, offset: 0, hasMore: false }
        });
      }

      // Superadmin needs an explicit org id (except for partnered view)
      let organizationId;
      if (req.user.role === 'superadmin') {
        if (!req.query.organizationId && req.query.partnered !== 'true') {
          return success(res, 'OK', {
            ambulances: [],
            pagination: { total: 0, limit, offset, hasMore: false }
          });
        }
        organizationId = req.query.organizationId;
      } else {
        organizationId = req.user.organizationId;
      }

      // Build query
      const filter = {};
      if (status) filter.status = status;

      if (req.query.partnered === 'true') {
        // Partnered view: select ambulances whose owning org has an active partnership with this hospital
        let hospitalIdForPartnered = null;
        if (req.user.role === 'superadmin') hospitalIdForPartnered = req.query.hospitalId;
        else if (req.user.organizationType === 'hospital') hospitalIdForPartnered = req.user.organizationId;

        if (!hospitalIdForPartnered) {
          return success(res, 'OK', { ambulances: [], pagination: { total: 0, limit, offset, hasMore: false } });
        }

        const partnerships = await Partnership.find({
          hospital_id: hospitalIdForPartnered,
          status: 'active'
        }).select('fleet_id').lean();
        const fleetIds = partnerships.map((p) => p.fleet_id);

        filter.organization_id = { $in: fleetIds };
        filter.status = filter.status || { $in: ['available', 'active', 'onboarded', 'in_transit'] };
      } else if (organizationId) {
        filter.organization_id = organizationId;
      }

      const [docs, total] = await Promise.all([
        populateAmbulance(Ambulance.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit)).lean(),
        Ambulance.countDocuments(filter)
      ]);

      return success(res, 'OK', {
        ambulances: docs.map(shapeAmbulance),
        pagination: { total, limit, offset, hasMore: offset + docs.length < total }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));
      const amb = await populateAmbulance(Ambulance.findById(id)).lean();
      if (!amb) return next(new AppError('Ambulance not found', 404));
      return success(res, 'OK', { ambulance: shapeAmbulance(amb) });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));

      const { vehicleModel, vehicleType, status } = req.body;
      const amb = await populateAmbulance(Ambulance.findById(id));
      if (!amb) return next(new AppError('Ambulance not found', 404));

      if (status === 'pending_approval') return next(new AppError('Cannot set status to pending_approval', 400));
      if (status === 'inactive' && req.user.role !== 'superadmin') {
        return next(new AppError('Only superadmin can set ambulance to inactive', 403));
      }

      // Maintenance: unassign all staff + offboard active sessions
      if (status === 'maintenance' && amb.status !== 'maintenance') {
        if (!['superadmin', 'hospital_admin', 'fleet_admin'].includes(req.user.role)) {
          return next(new AppError('Only admins can set ambulance to maintenance', 403));
        }
        const unassign = await AmbulanceAssignment.deleteMany({ ambulance_id: id });
        const offboard = await PatientSession.updateMany(
          { ambulance_id: id, status: { $in: ['active', 'onboarded', 'in_transit'] } },
          { status: 'offboarded', offboarded_at: new Date() }
        );
        if (vehicleModel !== undefined) amb.vehicle_model = vehicleModel;
        if (vehicleType !== undefined) amb.vehicle_type = vehicleType;
        amb.status = status;
        await amb.save();
        return success(res, 'Ambulance set to maintenance. All staff unassigned and patients offboarded.', {
          unassignedUsers: unassign.deletedCount || 0,
          offboardedSessions: offboard.modifiedCount || 0
        });
      }

      // Hospital activation locks the ambulance to that hospital — but only if there's a partnership
      const ambOrgType = amb.organization_id?.type;
      if (req.user.organizationType === 'hospital' && status === 'active') {
        const partnership = await Partnership.findOne({
          fleet_id: amb.organization_id?._id || amb.organization_id,
          hospital_id: req.user.organizationId
        });
        if (!partnership) {
          return next(new AppError('Cannot activate ambulance: no partnership exists between your hospital and the fleet owner', 403));
        }
        if (amb.current_hospital_id && !equalIds(amb.current_hospital_id._id || amb.current_hospital_id, req.user.organizationId)) {
          return next(new AppError('Ambulance is currently active for another hospital', 403));
        }
        if (vehicleModel !== undefined) amb.vehicle_model = vehicleModel;
        if (vehicleType !== undefined) amb.vehicle_type = vehicleType;
        amb.status = status;
        amb.current_hospital_id = toObjectId(req.user.organizationId);
        await amb.save();
        return success(res, 'Ambulance updated and locked for your hospital');
      }

      if (status === 'available') {
        if (vehicleModel !== undefined) amb.vehicle_model = vehicleModel;
        if (vehicleType !== undefined) amb.vehicle_type = vehicleType;
        amb.status = status;
        amb.current_hospital_id = null;
        await amb.save();
        return success(res, 'Ambulance updated and made available');
      }

      let warning = null;
      if (req.user.organizationType === 'fleet_owner' && amb.current_hospital_id) {
        warning = {
          message: 'This ambulance is currently active for a hospital',
          lockedByHospitalId: String(amb.current_hospital_id._id || amb.current_hospital_id)
        };
      }

      if (vehicleModel !== undefined) amb.vehicle_model = vehicleModel;
      if (vehicleType !== undefined) amb.vehicle_type = vehicleType;
      if (status !== undefined) amb.status = status;
      await amb.save();

      const payload = { success: true, message: 'Ambulance updated successfully' };
      if (warning) payload.warning = warning;
      return res.json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async approve(req, res, next) {
    try {
      if (req.user.role !== 'superadmin') return next(new AppError('Only superadmin can approve ambulances', 403));
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));

      const amb = await Ambulance.findById(id);
      if (!amb) return next(new AppError('Ambulance not found', 404));

      amb.status = 'available';
      amb.approved_by = req.user.id;
      amb.approved_at = new Date();
      await amb.save();

      try {
        await NotificationService.notifyAdminAmbulanceApproved(amb.organization_id, {
          id: String(amb._id),
          ambulance_code: amb.ambulance_code
        });
      } catch (e) {
        console.error('Failed to send ambulance approval notification:', e.message);
      }

      return success(res, 'Ambulance approved successfully');
    } catch (err) {
      next(err);
    }
  }

  static async assignUser(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, assigningOrganizationId } = req.body;

      if (!isValidId(id) || !isValidId(userId)) return next(new AppError('Invalid id', 400));

      const ambulance = await populateAmbulance(Ambulance.findById(id)).lean();
      if (!ambulance) return next(new AppError('Ambulance not found', 404));

      const user = await User.findById(userId).lean();
      if (!user) return next(new AppError('User not found', 404));
      if ((user.status || '').toLowerCase() === 'suspended') {
        return next(new AppError('Cannot assign suspended users to ambulances', 400));
      }

      const roleLower = (user.role || '').toLowerCase();
      if (!roleLower.includes('doctor') && !roleLower.includes('paramedic')) {
        return next(new AppError('Only doctors and paramedics can be assigned to ambulances', 400));
      }
      if ((ambulance.status || '').toLowerCase() === 'pending_approval') {
        return next(new AppError('Cannot assign staff to an ambulance that is pending approval', 400));
      }
      if ((ambulance.status || '').toLowerCase() === 'maintenance') {
        return next(new AppError('Cannot assign staff to an ambulance that is in maintenance', 400));
      }

      // Determine assigning org + permissions
      let assigningOrgToUse = null;
      let hospitalIdToValidate = null;

      if (req.user.role === 'superadmin') {
        if (assigningOrganizationId) {
          const org = await Organization.findById(assigningOrganizationId).lean();
          if (!org) return next(new AppError('Assigning organization not found', 404));
          assigningOrgToUse = assigningOrganizationId;
          if ((org.type || '').toLowerCase() === 'hospital') hospitalIdToValidate = assigningOrganizationId;
        }
      } else if (req.user.organizationType === 'hospital') {
        hospitalIdToValidate = req.user.organizationId;
        assigningOrgToUse = req.user.organizationId;
      } else if (req.user.organizationType === 'fleet_owner') {
        assigningOrgToUse = req.user.organizationId;
      }

      const ambOwnerId = String(ambulance.organization_id?._id || ambulance.organization_id);
      const ambOrgType = ambulance.organization_id?.type;

      if (hospitalIdToValidate) {
        if (equalIds(hospitalIdToValidate, ambOwnerId)) {
          // hospital assigning to its own ambulance: fine
        } else if (ambOrgType === 'fleet_owner') {
          const partnership = await Partnership.findOne({
            fleet_id: ambulance.organization_id?._id || ambulance.organization_id,
            hospital_id: hospitalIdToValidate
          });
          if (!partnership) {
            return next(new AppError('Your hospital does not have a partnership with this ambulance\'s fleet owner', 403));
          }
          if (ambulance.current_hospital_id &&
              !equalIds(ambulance.current_hospital_id?._id || ambulance.current_hospital_id, hospitalIdToValidate)) {
            const activeSession = await PatientSession.findOne({
              ambulance_id: id,
              status: { $in: ['onboarded', 'in_transit'] }
            }).select('destination_hospital_id').lean();
            if (activeSession && !equalIds(activeSession.destination_hospital_id, hospitalIdToValidate)) {
              return next(new AppError('Ambulance is currently active for another hospital and cannot be assigned', 403));
            }
          }
        } else {
          return next(new AppError("You cannot assign staff to another organization's ambulance", 403));
        }
      }

      // Upsert assignment
      await AmbulanceAssignment.findOneAndUpdate(
        { ambulance_id: id, user_id: userId, assigning_organization_id: assigningOrgToUse || null },
        {
          ambulance_id: id,
          user_id: userId,
          assigning_organization_id: assigningOrgToUse || null,
          assigned_by: req.user.id,
          role: user.role,
          is_active: true,
          assigned_at: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      try {
        await NotificationService.notifyUserAmbulanceAssignment(userId, {
          id: String(ambulance._id),
          ambulance_code: ambulance.ambulance_code
        });
      } catch (e) {
        console.error('Failed to send ambulance assignment notification:', e.message);
      }

      return success(res, 'User assigned to ambulance successfully');
    } catch (err) {
      next(err);
    }
  }

  static async unassignUser(req, res, next) {
    try {
      const { id, userId } = req.params;
      if (!isValidId(id) || !isValidId(userId)) return next(new AppError('Invalid id', 400));

      // doctors/paramedics can't unassign themselves
      if (equalIds(userId, req.user.id)) {
        const r = (req.user.role || '').toLowerCase();
        if (r.includes('doctor') || r.includes('paramedic')) {
          return next(new AppError('Doctors and paramedics cannot unassign themselves', 403));
        }
      }

      const assignment = await AmbulanceAssignment.findOne({
        ambulance_id: id,
        user_id: userId,
        is_active: true
      });
      if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

      const isAssigningOrg = equalIds(assignment.assigning_organization_id, req.user.organizationId);
      let isFleetOwnerOfAmbulance = false;
      if (req.user.organizationType === 'fleet_owner') {
        const amb = await Ambulance.findById(id).select('organization_id').lean();
        isFleetOwnerOfAmbulance = !!amb && equalIds(amb.organization_id, req.user.organizationId);
      }

      const canBypass = req.user.role === 'superadmin';
      if (!canBypass && !isAssigningOrg && !isFleetOwnerOfAmbulance) {
        return res.status(403).json({ success: false, message: 'You are not authorized to remove this assignment' });
      }

      assignment.is_active = false;
      await assignment.save();

      return success(res, 'User unassigned from ambulance successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getAssignedUsers(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));

      // Visibility rules:
      // - superadmin or fleet owner of the ambulance: see all active assignments
      // - hospital users: only their own org's assignments
      const ambulance = await Ambulance.findById(id).lean();
      if (!ambulance) return next(new AppError('Ambulance not found', 404));

      const baseFilter = { ambulance_id: id, is_active: true };
      let filter = baseFilter;

      if (req.user.role === 'superadmin') {
        filter = baseFilter;
      } else if (req.user.organizationType === 'hospital') {
        filter = { ...baseFilter, assigning_organization_id: req.user.organizationId };
      } else if (req.user.organizationType === 'fleet_owner') {
        if (!equalIds(ambulance.organization_id, req.user.organizationId)) {
          return success(res, 'OK', { users: [] });
        }
        filter = baseFilter;
      } else {
        return success(res, 'OK', { users: [] });
      }

      const rows = await AmbulanceAssignment.find(filter)
        .populate('user_id', 'first_name last_name email phone role')
        .populate('assigning_organization_id', 'name')
        .lean();

      const mapRoleLabel = (roleKey) => {
        if (!roleKey) return '';
        const r = roleKey.toString().toLowerCase();
        if (r.includes('doctor')) return 'Doctor';
        if (r.includes('paramedic')) return 'Paramedic';
        if (r.includes('driver')) return 'Driver';
        return roleKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      };

      const users = rows.map((row) => {
        const u = row.user_id || {};
        const org = row.assigning_organization_id || {};
        return {
          id: String(u._id || row.user_id),
          firstName: u.first_name || null,
          lastName: u.last_name || null,
          email: u.email || null,
          phone: u.phone || null,
          role: mapRoleLabel(u.role || row.role || ''),
          roleKey: u.role || row.role || '',
          assignedAt: row.assigned_at || null,
          assigningOrganizationId: org._id ? String(org._id) : null,
          assigningOrganizationName: org.name || null
        };
      });

      return success(res, 'OK', { users });
    } catch (err) {
      next(err);
    }
  }

  static async updateLocation(req, res, next) {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));

      await Ambulance.findByIdAndUpdate(id, {
        current_location_lat: latitude,
        current_location_lng: longitude,
        last_location_update: new Date()
      });

      const io = req.app.get('io');
      if (io) io.to(`ambulance_${id}`).emit('location_update', { ambulanceId: id, latitude, longitude });

      return success(res, 'Location updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));
      const amb = await Ambulance.findById(id);
      if (!amb) return next(new AppError('Ambulance not found', 404));
      await amb.deleteOne();
      return success(res, 'Ambulance deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getUserAmbulances(req, res, next) {
    try {
      const ambulances = await findAmbulancesAssignedToUser(req.user.id);
      return success(res, 'OK', { ambulances });
    } catch (err) {
      next(err);
    }
  }

  static async getAmbulancesForUser(req, res, next) {
    try {
      const { userId } = req.params;
      if (!isValidId(userId)) return next(new AppError('Invalid user id', 400));
      const target = await User.findById(userId).lean();
      if (!target) return next(new AppError('User not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(target.organization_id, req.user.organizationId)) {
        return next(new AppError('Access denied', 403));
      }
      const ambulances = await findAmbulancesAssignedToUser(userId);
      return success(res, 'OK', { ambulances });
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req, res, next) {
    try {
      if (req.user.role !== 'superadmin') return next(new AppError('Only superadmin can deactivate ambulances', 403));
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));

      const amb = await Ambulance.findById(id);
      if (!amb) return next(new AppError('Ambulance not found', 404));
      if (amb.status === 'inactive') return next(new AppError('Ambulance is already inactive', 400));

      const unassigned = await AmbulanceAssignment.deleteMany({ ambulance_id: id });
      const offboarded = await PatientSession.updateMany(
        { ambulance_id: id, status: { $in: ['active', 'onboarded', 'in_transit'] } },
        { status: 'offboarded', offboarded_at: new Date() }
      );

      amb.status = 'inactive';
      await amb.save();

      try {
        await ActivityLogService.log({
          activity: 'AMBULANCE_DEACTIVATED',
          comments: `Deactivated ambulance ${amb.registration_number}, unassigned ${unassigned.deletedCount} users, offboarded ${offboarded.modifiedCount} active sessions`,
          user: req.user,
          metadata: { ambulanceId: id },
          req
        });
      } catch (e) { console.error(e); }

      return success(res, 'Ambulance deactivated successfully', {
        ambulanceId: id,
        unassignedUsers: unassigned.deletedCount || 0,
        offboardedSessions: offboarded.modifiedCount || 0
      });
    } catch (err) {
      next(err);
    }
  }

  static async activate(req, res, next) {
    try {
      if (req.user.role !== 'superadmin') return next(new AppError('Only superadmin can activate ambulances', 403));
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid ambulance id', 400));

      const amb = await Ambulance.findById(id);
      if (!amb) return next(new AppError('Ambulance not found', 404));
      if (amb.status !== 'inactive') return next(new AppError('Only inactive ambulances can be activated', 400));

      amb.status = 'available';
      await amb.save();

      try {
        await ActivityLogService.log({
          activity: 'AMBULANCE_ACTIVATED',
          comments: `Activated ambulance ${amb.registration_number}`,
          user: req.user,
          metadata: { ambulanceId: id },
          req
        });
      } catch (e) { console.error(e); }

      return success(res, 'Ambulance activated successfully', { ambulanceId: id });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AmbulanceController;
