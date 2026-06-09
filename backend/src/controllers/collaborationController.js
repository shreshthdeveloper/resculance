const {
  CollaborationRequest,
  Organization,
  Partnership,
  Ambulance,
  AmbulanceAssignment,
  PatientSession,
  User
} = require('../models');
const { AppError } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const NotificationService = require('../services/notificationService');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');

function shapeRequest(r) {
  if (!r) return null;
  const o = r.toObject ? r.toObject() : r;
  const hospital = (o.hospital_id && typeof o.hospital_id === 'object') ? o.hospital_id : null;
  const fleet = (o.fleet_id && typeof o.fleet_id === 'object') ? o.fleet_id : null;
  const requester = (o.requested_by && typeof o.requested_by === 'object') ? o.requested_by : null;
  const approver = (o.approved_by && typeof o.approved_by === 'object') ? o.approved_by : null;
  return {
    ...o,
    id: String(o._id || o.id),
    hospital_id: hospital ? String(hospital._id) : (o.hospital_id ? String(o.hospital_id) : null),
    fleet_id: fleet ? String(fleet._id) : (o.fleet_id ? String(o.fleet_id) : null),
    hospital_name: hospital?.name,
    hospital_code: hospital?.code,
    hospital_city: hospital?.city,
    hospital_state: hospital?.state,
    fleet_name: fleet?.name,
    fleet_code: fleet?.code,
    fleet_city: fleet?.city,
    fleet_state: fleet?.state,
    requester_first_name: requester?.first_name,
    requester_last_name: requester?.last_name,
    requester_organization_id: requester?.organization_id ? String(requester.organization_id) : null,
    approver_first_name: approver?.first_name,
    approver_last_name: approver?.last_name
  };
}

function populateRequest(query) {
  return query
    .populate('hospital_id', 'name code city state type')
    .populate('fleet_id', 'name code city state type')
    .populate('requested_by', 'first_name last_name organization_id')
    .populate('approved_by', 'first_name last_name');
}

/**
 * When a fleet⇄hospital partnership is deactivated, release the operational
 * links between the two orgs: free any ambulances the fleet had locked to the
 * hospital and unassign hospital staff from the fleet's ambulances — always
 * skipping anything tied to an active patient session. Extracted from cancel()
 * so the partnership toggle reuses the exact same behaviour.
 */
async function releaseFleetHospitalLinks(fleetId, hospitalId, userId) {
  // Release ambulance locks (skip ones with active sessions)
  const lockedAmbulances = await Ambulance.find({
    organization_id: fleetId,
    current_hospital_id: hospitalId
  });
  for (const amb of lockedAmbulances) {
    const activeCount = await PatientSession.countDocuments({
      ambulance_id: amb._id,
      status: { $in: ['onboarded', 'in_transit'] }
    });
    if (activeCount === 0) {
      amb.current_hospital_id = null;
      await amb.save();
      try {
        await audit({
          userId,
          action: 'release_ambulance_from_hospital',
          entityType: 'ambulance',
          entityId: amb._id,
          oldValues: { current_hospital_id: String(hospitalId) },
          newValues: { current_hospital_id: null }
        });
      } catch (e) { console.error(e); }
    }
  }

  // Unassign hospital staff from this fleet's ambulances
  const hospitalUserIds = await User.find({ organization_id: hospitalId }).distinct('_id');
  const fleetAmbulanceIds = await Ambulance.find({ organization_id: fleetId }).distinct('_id');
  const candidateAssignments = await AmbulanceAssignment.find({
    ambulance_id: { $in: fleetAmbulanceIds },
    user_id: { $in: hospitalUserIds },
    is_active: true
  });

  for (const assignment of candidateAssignments) {
    const activeCount = await PatientSession.countDocuments({
      ambulance_id: assignment.ambulance_id,
      status: { $in: ['onboarded', 'in_transit'] }
    });
    if (activeCount > 0) {
      try {
        await audit({
          userId,
          action: 'skip_unassign_active_session',
          entityType: 'ambulance_assignment',
          entityId: assignment._id,
          oldValues: { ambulance_id: String(assignment.ambulance_id), user_id: String(assignment.user_id) },
          newValues: { skipped: true }
        });
      } catch (e) { console.error(e); }
      continue;
    }
    assignment.is_active = false;
    await assignment.save();
    try {
      await audit({
        userId,
        action: 'auto_unassign_on_partnership_cancel',
        entityType: 'ambulance_assignment',
        entityId: assignment._id,
        oldValues: { is_active: true },
        newValues: { is_active: false }
      });
    } catch (e) { console.error(e); }
  }
}

/**
 * Activate or deactivate the partnership for a single (fleet, hospital) pair.
 * Mirrors the accept()/cancel() side effects so the management matrix stays
 * consistent with the request-driven flow:
 *   - active=true  → upsert Partnership active + an approved CollaborationRequest
 *   - active=false → Partnership inactive + cancel its request + release links
 * Callers are responsible for validating that the org ids exist and are the
 * right types. Returns { fleetId, hospitalId, status }.
 */
async function applySetPartnership({ fleetId, hospitalId, active, userId }) {
  if (active) {
    const partnership = await Partnership.findOneAndUpdate(
      { fleet_id: fleetId, hospital_id: hospitalId },
      {
        $setOnInsert: { fleet_id: fleetId, hospital_id: hospitalId, created_by: userId, start_date: new Date() },
        $set: { status: 'active' }
      },
      { upsert: true, new: true }
    );

    // Keep the request list in sync: reuse the latest request for this pair, or
    // create an approved one so it shows up alongside request-driven partnerships.
    const existingReq = await CollaborationRequest.findOne({ fleet_id: fleetId, hospital_id: hospitalId })
      .sort({ created_at: -1 });
    if (existingReq) {
      if (existingReq.status !== 'approved') {
        existingReq.status = 'approved';
        existingReq.approved_by = userId;
        existingReq.approved_at = new Date();
        await existingReq.save();
      }
    } else {
      await CollaborationRequest.create({
        hospital_id: hospitalId,
        fleet_id: fleetId,
        request_type: 'partnership',
        status: 'approved',
        requested_by: userId,
        approved_by: userId,
        approved_at: new Date(),
        message: 'Created via partnership manager'
      });
    }

    try {
      await audit({
        userId,
        action: 'create_partnership',
        entityType: 'partnership',
        entityId: partnership._id,
        newValues: { fleetId: String(fleetId), hospitalId: String(hospitalId), status: 'active' }
      });
    } catch (e) { console.error(e); }

    return { fleetId: String(fleetId), hospitalId: String(hospitalId), status: 'active' };
  }

  // Deactivate
  const partnership = await Partnership.findOne({ fleet_id: fleetId, hospital_id: hospitalId });
  if (partnership && partnership.status === 'active') {
    partnership.status = 'inactive';
    await partnership.save();
    try {
      await audit({
        userId,
        action: 'cancel_partnership',
        entityType: 'partnership',
        entityId: partnership._id,
        oldValues: { status: 'active' },
        newValues: { status: 'inactive' }
      });
    } catch (e) { console.error(e); }
  }

  // Cancel any live request rows for this pair so the list view reflects it.
  await CollaborationRequest.updateMany(
    { fleet_id: fleetId, hospital_id: hospitalId, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'cancelled' } }
  );

  await releaseFleetHospitalLinks(fleetId, hospitalId, userId);

  return { fleetId: String(fleetId), hospitalId: String(hospitalId), status: 'inactive' };
}

class CollaborationController {
  static async create(req, res, next) {
    try {
      const { fleetId, hospitalId, requestType = 'partnership', message, terms } = req.body;
      if (!fleetId || !hospitalId) return next(new AppError('Both hospital and fleet must be specified', 400));
      if (!isValidId(fleetId) || !isValidId(hospitalId)) return next(new AppError('Invalid org id', 400));

      const [fleet, hospital] = await Promise.all([
        Organization.findById(fleetId),
        Organization.findById(hospitalId)
      ]);
      if (!fleet || fleet.type !== 'fleet_owner') return next(new AppError('Fleet owner not found', 404));
      if (!hospital || hospital.type !== 'hospital') return next(new AppError('Hospital not found', 404));

      if (req.user.role !== 'superadmin') {
        if (req.user.organizationType === 'hospital' && !equalIds(hospitalId, req.user.organizationId)) {
          return next(new AppError('Hospital admins can only create requests from their own hospital', 403));
        }
        if (req.user.organizationType === 'fleet_owner' && !equalIds(fleetId, req.user.organizationId)) {
          return next(new AppError('Fleet admins can only create requests from their own fleet', 403));
        }
      }

      const existing = await CollaborationRequest.findOne({
        fleet_id: fleetId,
        hospital_id: hospitalId,
        status: { $in: ['pending', 'approved'] }
      });
      if (existing) {
        if (existing.status === 'approved') {
          return next(new AppError('An active partnership already exists between these organizations', 400));
        }
        return next(new AppError('A pending partnership request already exists between these organizations', 400));
      }

      const created = await CollaborationRequest.create({
        hospital_id: hospitalId,
        fleet_id: fleetId,
        request_type: requestType,
        message,
        terms,
        requested_by: req.user.id,
        status: 'pending'
      });

      try {
        const requesterOrg = req.user.organizationType === 'hospital' ? hospital : fleet;
        const targetOrg = req.user.organizationType === 'hospital' ? fleet : hospital;
        await NotificationService.notifyAdminsCollaborationRequest(targetOrg._id, {
          id: String(created._id),
          requesterOrgName: requesterOrg.name
        });
      } catch (e) {
        console.error('Failed to send collaboration request notification:', e.message);
      }

      return success(res, 'Collaboration request sent successfully', { requestId: String(created._id) }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      const { status } = req.query;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;

      const filter = {};
      if (status) filter.status = status;

      if (req.user.role !== 'superadmin') {
        if (req.user.organizationType === 'hospital') filter.hospital_id = req.user.organizationId;
        else if (req.user.organizationType === 'fleet_owner') filter.fleet_id = req.user.organizationId;
      }

      const [docs, total] = await Promise.all([
        populateRequest(
          CollaborationRequest.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit)
        ).lean(),
        CollaborationRequest.countDocuments(filter)
      ]);

      return success(res, 'OK', {
        requests: docs.map(shapeRequest),
        pagination: { total, limit, offset, hasMore: offset + docs.length < total }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));

      const request = await populateRequest(CollaborationRequest.findById(id)).lean();
      if (!request) return next(new AppError('Collaboration request not found', 404));

      if (req.user.role !== 'superadmin' &&
          !equalIds(request.hospital_id?._id || request.hospital_id, req.user.organizationId) &&
          !equalIds(request.fleet_id?._id || request.fleet_id, req.user.organizationId)) {
        return next(new AppError('Access denied', 403));
      }

      return success(res, 'OK', { request: shapeRequest(request) });
    } catch (err) {
      next(err);
    }
  }

  static async getMyPartnerships(req, res, next) {
    try {
      if (req.user.organizationType === 'hospital') {
        const partnerships = await Partnership.find({ hospital_id: req.user.organizationId, status: 'active' })
          .populate('fleet_id', 'name code')
          .populate('hospital_id', 'name code')
          .lean();
        return success(res, 'OK', { partnerships });
      }
      if (req.user.organizationType === 'fleet_owner') {
        const partnerships = await Partnership.find({ fleet_id: req.user.organizationId, status: 'active' })
          .populate('fleet_id', 'name code')
          .populate('hospital_id', 'name code')
          .lean();
        return success(res, 'OK', { partnerships });
      }
      const partnerships = await Partnership.find({})
        .populate('fleet_id', 'name code')
        .populate('hospital_id', 'name code')
        .lean();
      return success(res, 'OK', { partnerships });
    } catch (err) {
      next(err);
    }
  }

  static async accept(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectedReason } = req.body;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));

      const request = await CollaborationRequest.findById(id).populate('requested_by', 'organization_id');
      if (!request) return next(new AppError('Collaboration request not found', 404));

      const requesterOrgId = request.requested_by?.organization_id;
      const isRequesterHospital = equalIds(requesterOrgId, request.hospital_id);
      const recipientOrgId = isRequesterHospital ? request.fleet_id : request.hospital_id;

      if (req.user.role !== 'superadmin' && !equalIds(recipientOrgId, req.user.organizationId)) {
        return next(new AppError('Only the recipient organization can accept this collaboration request', 403));
      }
      if (request.status !== 'pending') return next(new AppError('Request has already been processed', 400));

      request.status = 'approved';
      request.approved_by = req.user.id;
      request.approved_at = new Date();
      request.rejected_reason = rejectedReason || null;
      await request.save();

      // Ensure partnership exists / is active
      const partnership = await Partnership.findOneAndUpdate(
        { fleet_id: request.fleet_id, hospital_id: request.hospital_id },
        {
          $setOnInsert: { fleet_id: request.fleet_id, hospital_id: request.hospital_id, created_by: req.user.id },
          $set: { status: 'active' }
        },
        { upsert: true, new: true }
      );

      try {
        await audit({
          userId: req.user.id,
          action: 'create_partnership',
          entityType: 'partnership',
          entityId: partnership._id,
          newValues: {
            fleetId: String(request.fleet_id),
            hospitalId: String(request.hospital_id),
            status: 'active'
          }
        });
      } catch (e) { console.error(e); }

      try {
        const [hospital, fleet] = await Promise.all([
          Organization.findById(request.hospital_id).lean(),
          Organization.findById(request.fleet_id).lean()
        ]);
        await NotificationService.notifyAdminsCollaborationAccepted(request.hospital_id, {
          id: String(request._id),
          recipientOrgName: fleet?.name
        });
        await NotificationService.notifySuperadminsPartnershipAccepted({
          id: String(request._id),
          requesterOrgName: hospital?.name,
          recipientOrgName: fleet?.name
        });
      } catch (e) {
        console.error('Failed to send partnership acceptance notifications:', e.message);
      }

      return success(res, 'Collaboration request accepted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async reject(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectedReason } = req.body;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));

      const request = await CollaborationRequest.findById(id);
      if (!request) return next(new AppError('Collaboration request not found', 404));

      const isFleetOwner = equalIds(request.fleet_id, req.user.organizationId);
      const isHospital = equalIds(request.hospital_id, req.user.organizationId);
      if (req.user.role !== 'superadmin' && !isFleetOwner && !isHospital) {
        return next(new AppError('You do not have permission to reject this collaboration request', 403));
      }
      if (request.status !== 'pending') return next(new AppError('Request has already been processed', 400));

      request.status = 'rejected';
      request.approved_by = req.user.id;
      request.approved_at = new Date();
      request.rejected_reason = rejectedReason || null;
      await request.save();

      try {
        await audit({
          userId: req.user.id,
          action: 'reject_collaboration_request',
          entityType: 'collaboration_request',
          entityId: request._id,
          oldValues: { status: 'pending' },
          newValues: { status: 'rejected', rejectedReason }
        });
      } catch (e) { console.error(e); }

      return success(res, 'Collaboration request rejected');
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));

      const request = await CollaborationRequest.findById(id);
      if (!request) return next(new AppError('Collaboration request not found', 404));

      const isRequesterHospital = equalIds(request.hospital_id, req.user.organizationId);
      const isFleetOwner = equalIds(request.fleet_id, req.user.organizationId);
      if (!(req.user.role === 'superadmin' || isRequesterHospital || isFleetOwner)) {
        return next(new AppError('Only the requesting hospital, the fleet owner or superadmin can cancel this request', 403));
      }

      if (request.status === 'pending') {
        const old = request.status;
        request.status = 'cancelled';
        await request.save();
        await audit({
          userId: req.user.id,
          action: 'cancel_collaboration_request',
          entityType: 'collaboration_request',
          entityId: request._id,
          oldValues: { status: old },
          newValues: { status: 'cancelled' }
        });
        return success(res, 'Collaboration request cancelled');
      }

      if (request.status !== 'approved') {
        return next(new AppError('Only pending or approved requests can be cancelled', 400));
      }

      // Approved → cancelled: also deactivate the partnership, release ambulance locks,
      // and unassign hospital staff from this fleet's ambulances (skipping any with an active session)
      const old = request.status;
      request.status = 'cancelled';
      await request.save();

      const partnership = await Partnership.findOne({
        fleet_id: request.fleet_id,
        hospital_id: request.hospital_id
      });
      if (partnership && partnership.status === 'active') {
        const oldStatus = partnership.status;
        partnership.status = 'inactive';
        await partnership.save();
        try {
          await audit({
            userId: req.user.id,
            action: 'cancel_partnership',
            entityType: 'partnership',
            entityId: partnership._id,
            oldValues: { status: oldStatus },
            newValues: { status: 'inactive' }
          });
        } catch (e) { console.error(e); }
      }

      // Release ambulance locks + unassign hospital staff (skips active sessions)
      await releaseFleetHospitalLinks(request.fleet_id, request.hospital_id, req.user.id);

      try {
        await audit({
          userId: req.user.id,
          action: 'cancel_collaboration_request',
          entityType: 'collaboration_request',
          entityId: request._id,
          oldValues: { status: old },
          newValues: { status: 'cancelled' }
        });
      } catch (e) { console.error(e); }

      return success(res, 'Collaboration request cancelled and partnership deactivated');
    } catch (err) {
      next(err);
    }
  }

  // PATCH /collaborations/partnerships/set   (superadmin)
  // Body: { fleetId, hospitalId, active }
  // Activates (creating if needed) or deactivates a single partnership.
  static async setPartnership(req, res, next) {
    try {
      const { fleetId, hospitalId, active } = req.body || {};
      if (!isValidId(fleetId) || !isValidId(hospitalId)) return next(new AppError('Invalid org id', 400));
      if (typeof active !== 'boolean') return next(new AppError('`active` (boolean) is required', 400));

      const [fleet, hospital] = await Promise.all([
        Organization.findById(fleetId).lean(),
        Organization.findById(hospitalId).lean()
      ]);
      if (!fleet || fleet.type !== 'fleet_owner') return next(new AppError('Fleet owner not found', 404));
      if (!hospital || hospital.type !== 'hospital') return next(new AppError('Hospital not found', 404));

      const result = await applySetPartnership({ fleetId, hospitalId, active, userId: req.user.id });
      return success(res, `Partnership ${active ? 'activated' : 'deactivated'}`, { partnership: result });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /collaborations/partnerships/bulk   (superadmin)
  // Body: { pairs: [{ fleetId, hospitalId }], active }
  // Applies the same activate/deactivate to many pairs at once (used by the
  // "activate all / deactivate all" controls on a fleet or hospital row).
  static async bulkSetPartnerships(req, res, next) {
    try {
      const { pairs, active } = req.body || {};
      if (!Array.isArray(pairs) || pairs.length === 0) return next(new AppError('`pairs` array is required', 400));
      if (pairs.length > 1000) return next(new AppError('Too many pairs in one request (max 1000)', 400));
      if (typeof active !== 'boolean') return next(new AppError('`active` (boolean) is required', 400));

      // Validate referenced orgs once up front.
      const fleetIds = [...new Set(pairs.map((p) => p.fleetId).filter(isValidId))];
      const hospitalIds = [...new Set(pairs.map((p) => p.hospitalId).filter(isValidId))];
      const [fleets, hospitals] = await Promise.all([
        Organization.find({ _id: { $in: fleetIds }, type: 'fleet_owner' }).distinct('_id'),
        Organization.find({ _id: { $in: hospitalIds }, type: 'hospital' }).distinct('_id')
      ]);
      const validFleets = new Set(fleets.map(String));
      const validHospitals = new Set(hospitals.map(String));

      const results = [];
      let failed = 0;
      for (const p of pairs) {
        if (!validFleets.has(String(p.fleetId)) || !validHospitals.has(String(p.hospitalId))) {
          failed += 1;
          continue;
        }
        try {
          results.push(await applySetPartnership({
            fleetId: p.fleetId, hospitalId: p.hospitalId, active, userId: req.user.id
          }));
        } catch (e) {
          console.error('bulkSetPartnerships pair failed:', e.message);
          failed += 1;
        }
      }

      return success(res, `Updated ${results.length} partnership${results.length !== 1 ? 's' : ''}`, {
        updated: results.length,
        failed,
        partnerships: results
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CollaborationController;
