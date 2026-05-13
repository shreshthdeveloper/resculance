const { Organization, Ambulance, User, Partnership, PatientSession } = require('../models');
const { AppError } = require('../middleware/auth');
const ActivityLogService = require('../services/activityLogService');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');

function buildOrgPayload(body) {
  const payload = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.address !== undefined) payload.address = body.address;
  if (body.city !== undefined) payload.city = body.city;
  if (body.state !== undefined) payload.state = body.state;

  const pincode = body.zipCode || body.postalCode || body.pincode;
  if (pincode !== undefined) payload.pincode = pincode;

  const contactPerson = body.contactPerson || body.contact_person;
  if (contactPerson !== undefined) payload.contact_person = contactPerson;

  const email = body.email || body.contactEmail || body.contact_email;
  if (email !== undefined) payload.contact_email = email;

  const phone = body.phone || body.contactPhone || body.contact_phone;
  if (phone !== undefined) payload.contact_phone = phone;

  if (body.licenseNumber !== undefined || body.license_number !== undefined) {
    payload.license_number = body.licenseNumber || body.license_number;
  }
  if (body.status !== undefined) payload.status = body.status;
  if (body.is_active !== undefined) payload.is_active = body.is_active;
  return payload;
}

function shapeOrg(org) {
  if (!org) return null;
  const o = org.toObject ? org.toObject() : org;
  return {
    ...o,
    id: String(o._id || o.id),
    email: o.contact_email,
    phone: o.contact_phone,
    contactPerson: o.contact_person,
    licenseNumber: o.license_number,
    postalCode: o.pincode
  };
}

class OrganizationController {
  static async create(req, res, next) {
    try {
      const { name, type, email } = req.body;
      const contactPerson = req.body.contactPerson || req.body.contact_person;
      if (!contactPerson) return next(new AppError('Contact person is required', 400));

      const orgType = (type || '').toLowerCase();
      if (orgType === 'superadmin') {
        return next(new AppError('Cannot create superadmin organization type via this endpoint', 400));
      }

      if (email) {
        const existing = await Organization.findOne({
          $or: [{ contact_email: email }]
        });
        if (existing) return next(new AppError('Organization email already in use', 409));
      }

      const prefix = orgType === 'hospital' ? 'HOSP' : 'FLEET';
      const code = `${prefix}-${Math.floor(Math.random() * 9000) + 1000}`;

      const payload = buildOrgPayload(req.body);
      payload.name = name;
      payload.code = code;
      payload.type = orgType;
      payload.status = payload.status || 'active';
      payload.is_active = payload.is_active !== undefined ? payload.is_active : true;

      const newOrg = await Organization.create(payload);
      await ActivityLogService.logOrgCreated(req.user, newOrg, req);

      return success(res, 'Organization created successfully', {
        id: String(newOrg._id),
        code: newOrg.code,
        name: newOrg.name,
        type: newOrg.type
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      const { type, status, is_active } = req.query;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;

      const filter = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (is_active !== undefined) filter.is_active = is_active === 'true' || is_active === true || is_active === 1;

      if (req.user.role !== 'superadmin') {
        if (type) {
          // honour the type filter even for non-superadmin (used by collaboration UI)
          const [docs, total] = await Promise.all([
            Organization.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).lean(),
            Organization.countDocuments(filter)
          ]);
          return success(res, 'OK', {
            organizations: docs.map(shapeOrg),
            pagination: { total, limit, offset, hasMore: offset + docs.length < total }
          });
        }

        // Otherwise: only their own org
        const own = await Organization.findById(req.user.organizationId).lean();
        return success(res, 'OK', {
          organizations: own ? [shapeOrg(own)] : [],
          pagination: { total: own ? 1 : 0, limit, offset, hasMore: false }
        });
      }

      const [docs, total] = await Promise.all([
        Organization.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).lean(),
        Organization.countDocuments(filter)
      ]);
      return success(res, 'OK', {
        organizations: docs.map(shapeOrg),
        pagination: { total, limit, offset, hasMore: offset + docs.length < total }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid organization id', 400));

      const organization = await Organization.findById(id).lean();
      if (!organization) return next(new AppError('Organization not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(organization._id, req.user.organizationId)) {
        return next(new AppError('You do not have permission to view this organization', 403));
      }

      return success(res, 'OK', { organization: shapeOrg(organization) });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid organization id', 400));

      const contactPerson = req.body.contactPerson || req.body.contact_person;
      if (!contactPerson) return next(new AppError('Contact person is required', 400));

      const email = req.body.email || req.body.contactEmail || req.body.contact_email;
      if (email) {
        const existing = await Organization.findOne({ contact_email: email });
        if (existing && !equalIds(existing._id, id)) {
          return next(new AppError('Organization email already in use', 409));
        }
      }

      const organization = await Organization.findById(id);
      if (!organization) return next(new AppError('Organization not found', 404));

      const payload = buildOrgPayload(req.body);
      Object.assign(organization, payload);
      await organization.save();

      await ActivityLogService.logOrgUpdated(req.user, organization, payload, req);

      return success(res, 'Organization updated successfully', { organization: shapeOrg(organization) });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid organization id', 400));

      const organization = await Organization.findById(id);
      if (!organization) return next(new AppError('Organization not found', 404));
      if (organization.type === 'superadmin') {
        return next(new AppError('Cannot delete superadmin organization', 403));
      }

      organization.is_active = false;
      organization.status = 'suspended';
      await organization.save();

      await ActivityLogService.logOrgDeactivated(req.user, organization, req);
      return success(res, 'Organization deactivated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid organization id', 400));

      const organization = await Organization.findById(id);
      if (!organization) return next(new AppError('Organization not found', 404));
      if (organization.type === 'superadmin') {
        return next(new AppError('Cannot deactivate superadmin organization', 403));
      }

      // Cascade: in Mongo we don't get free transactions on a standalone, but we can
      // sequence updates and tolerate partial failures (the controller used to use a
      // SQL transaction; here we just keep going).
      organization.is_active = false;
      organization.status = 'suspended';
      await organization.save();

      await Ambulance.updateMany({ organization_id: id }, { status: 'disabled' });
      await User.updateMany({ organization_id: id }, { status: 'suspended' });
      await Partnership.updateMany({ $or: [{ fleet_id: id }, { hospital_id: id }] }, { status: 'inactive' });
      await PatientSession.updateMany(
        { organization_id: id, status: { $in: ['onboarded', 'in_transit'] } },
        { status: 'offboarded', offboarded_at: new Date() }
      );

      await ActivityLogService.logOrgDeactivated(req.user, organization, req);
      return success(res, 'Organization deactivated. Ambulances disabled, users suspended, partnerships inactivated, and patients offboarded.');
    } catch (err) {
      next(err);
    }
  }

  static async activate(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid organization id', 400));

      const organization = await Organization.findById(id);
      if (!organization) return next(new AppError('Organization not found', 404));

      organization.is_active = true;
      organization.status = 'active';
      await organization.save();

      // Reactivate approved ambulances that were disabled
      await Ambulance.updateMany(
        { organization_id: id, status: 'disabled', approved_at: { $ne: null } },
        { status: 'available' }
      );
      // Reactivate suspended users
      await User.updateMany(
        { organization_id: id, status: 'suspended' },
        { status: 'active' }
      );

      await ActivityLogService.logOrgActivated(req.user, organization, req);
      return success(res, 'Organization activated. Approved ambulances and previously suspended users reactivated where applicable.');
    } catch (err) {
      next(err);
    }
  }

  static async suspend(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid organization id', 400));
      await Organization.findByIdAndUpdate(id, { status: 'suspended' });
      return success(res, 'Organization suspended successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = OrganizationController;
