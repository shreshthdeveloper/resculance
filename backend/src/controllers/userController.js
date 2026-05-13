const path = require('path');
const fs = require('fs');

const { User, Organization, AmbulanceAssignment } = require('../models');
const { AppError } = require('../middleware/auth');
const { normalizeRole, normalizeStatus } = require('../utils/roleUtils');
const NotificationService = require('../services/notificationService');
const { success } = require('../utils/response');
const { canApproveRole } = require('../config/permissions');
const { isValidId, equalIds } = require('../utils/ids');
const storage = require('../services/storageService');
const log = require('../utils/logger').child('users');

// Mirror of dropOldAvatar in authController — kept local to avoid creating
// a circular import. If we add a third upload site we'll lift this into
// a shared helper.
async function dropOldAvatarLegacy(profileImageUrl) {
  if (!profileImageUrl) return;
  const cfg = storage.config();
  const bucketTag = `/${cfg.bucket}/profiles/`;
  if (profileImageUrl.includes(bucketTag)) {
    const key = profileImageUrl.slice(profileImageUrl.indexOf(bucketTag) + 1).split('?')[0];
    await storage.deleteObject(key).catch((e) => log.warn('avatar minio delete failed', { msg: e.message }));
    return;
  }
  if (profileImageUrl.includes('/uploads/profiles/')) {
    try {
      const oldFilename = profileImageUrl.split('/uploads/profiles/').pop();
      const oldPath = path.join(__dirname, '..', '..', 'uploads', 'profiles', oldFilename);
      if (oldFilename && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (e) {
      log.warn('legacy avatar disk delete failed', { msg: e.message });
    }
  }
}

function shapeUser(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  const org = u.organization_id && typeof u.organization_id === 'object' ? u.organization_id : null;
  delete u.password;
  return {
    ...u,
    id: String(u._id || u.id),
    organization_id: org ? String(org._id || org.id) : u.organization_id,
    organization_name: org?.name,
    organization_code: org?.code,
    organization_type: org?.type,
    organizationId: org ? String(org._id || org.id) : (u.organization_id ? String(u.organization_id) : null),
    organizationType: org?.type,
    organizationName: org?.name,
    firstName: u.first_name,
    lastName: u.last_name,
    profileImageUrl: u.profile_image_url
  };
}

class UserController {
  static async create(req, res, next) {
    try {
      const { email, password, firstName, lastName, role, phone } = req.body;

      if (!['superadmin', 'hospital_admin', 'fleet_admin'].includes(req.user.role)) {
        return next(new AppError('You do not have permission to create users', 403));
      }

      if (await User.findOne({ email })) {
        return next(new AppError('Email already in use', 400));
      }

      const username = email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 6);

      let organizationId = req.user.role === 'superadmin'
        ? req.body.organizationId
        : req.user.organizationId;

      // Frontend may flag a global superadmin creation by passing organizationType=superadmin
      if (req.user.role === 'superadmin' && (req.body.organizationType || '').toString().toLowerCase() === 'superadmin') {
        organizationId = null;
      }

      let orgType = req.user.organizationType;
      if (req.user.role === 'superadmin' && organizationId) {
        const org = await Organization.findById(organizationId).select('type').lean();
        orgType = org?.type || orgType;
      }

      const normalizedRole = await normalizeRole(role, orgType, organizationId);

      if ((normalizedRole || '').toLowerCase() === 'superadmin') {
        if (!organizationId) {
          const sys = await Organization.findOne({ code: 'SYSTEM' }).select('_id').lean();
          if (!sys) return next(new AppError('System organization not found. Please run seed.', 500));
          organizationId = sys._id;
        }
      }

      if (!organizationId) return next(new AppError('organizationId is required', 400));

      const normalizedStatus = normalizeStatus(req.body.status) || 'pending_approval';

      const user = await User.create({
        email,
        username,
        password,
        first_name: firstName,
        last_name: lastName,
        role: normalizedRole,
        phone,
        organization_id: organizationId,
        status: normalizedStatus,
        created_by: req.user.id
      });

      if (normalizedRole.includes('admin')) {
        try {
          const org = await Organization.findById(organizationId).select('name').lean();
          await NotificationService.notifySuperadminsNewAdmin({
            id: String(user._id),
            role: normalizedRole,
            firstName,
            lastName,
            organizationName: org?.name || 'Unknown'
          });
        } catch (notifErr) {
          console.error('Failed to notify superadmins about new admin:', notifErr.message);
        }
      }

      return success(res, 'User created successfully. Awaiting approval.', { userId: String(user._id) }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      let { role, status } = req.query;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;

      status = normalizeStatus(status);
      const originalRole = role;

      const rawStatus = req.query.status;
      const isPendingRequest =
        (rawStatus && String(rawStatus).toLowerCase() === 'pending') ||
        (status && String(status).toLowerCase() === 'pending_approval');

      if (
        req.user.role === 'superadmin' &&
        !(originalRole && String(originalRole).trim().toLowerCase() === 'superadmin') &&
        !req.query.organizationId &&
        !isPendingRequest
      ) {
        return next(new AppError('organizationId is required when superadmin is viewing non-superadmin users', 400));
      }

      let organizationId;
      if (req.user.role === 'superadmin' && isPendingRequest) {
        organizationId = undefined;
      } else if (req.user.role === 'superadmin') {
        organizationId = req.query.organizationId;
      } else {
        organizationId = req.user.organizationId;
      }

      if (role) {
        role = await normalizeRole(role, req.user.organizationType, organizationId);
      }
      let roleFilter = role;
      if (originalRole && String(originalRole).trim().toLowerCase() === 'doctor') {
        roleFilter = ['hospital_doctor', 'fleet_doctor'];
      }

      const filter = {};
      if (organizationId) filter.organization_id = organizationId;
      if (status) filter.status = status;
      if (roleFilter) filter.role = Array.isArray(roleFilter) ? { $in: roleFilter } : roleFilter;

      const [docs, total] = await Promise.all([
        User.find(filter)
          .sort({ created_at: -1 })
          .skip(offset)
          .limit(limit)
          .populate('organization_id', 'name code type')
          .lean(),
        User.countDocuments(filter)
      ]);

      return success(res, 'OK', {
        users: docs.map(shapeUser),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + docs.length < total
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));

      const user = await User.findById(id).populate('organization_id', 'name code type').lean();
      if (!user) return next(new AppError('User not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(user.organization_id?._id || user.organization_id, req.user.organizationId)) {
        return next(new AppError('Access denied', 403));
      }

      return success(res, 'OK', { user: shapeUser(user) });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));

      const { firstName, lastName, phone, status, role, organizationId: bodyOrganizationId, profileImageUrl } = req.body;

      const user = await User.findById(id);
      if (!user) return next(new AppError('User not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(user.organization_id, req.user.organizationId)) {
        return next(new AppError('Access denied', 403));
      }

      if (firstName !== undefined) user.first_name = firstName;
      if (lastName !== undefined) user.last_name = lastName;
      if (phone !== undefined) user.phone = phone;
      if (status !== undefined) user.status = normalizeStatus(status);
      if (profileImageUrl !== undefined) user.profile_image_url = profileImageUrl;

      if (role && req.user.role === 'superadmin') {
        let effectiveOrgId = bodyOrganizationId || user.organization_id;
        let orgType = null;
        if (effectiveOrgId) {
          const org = await Organization.findById(effectiveOrgId).select('type').lean();
          orgType = org?.type;
        }
        const normalizedRole = await normalizeRole(role, orgType, effectiveOrgId);
        user.role = normalizedRole;

        if ((normalizedRole || '').toString().toLowerCase() === 'superadmin') {
          if (!effectiveOrgId) {
            const sys = await Organization.findOne({ code: 'SYSTEM' }).select('_id').lean();
            if (!sys) return next(new AppError('System organization not found.', 500));
            user.organization_id = sys._id;
          } else {
            user.organization_id = effectiveOrgId;
          }
        } else if (bodyOrganizationId) {
          user.organization_id = bodyOrganizationId;
        }
      }

      await user.save();
      return success(res, 'User updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async uploadProfileImageForUser(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));
      const file = req.file;
      if (!file || !file.buffer) return next(new AppError('No file uploaded', 400));

      const target = await User.findById(id);
      if (!target) return next(new AppError('User not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(target.organization_id, req.user.organizationId)) {
        return next(new AppError('Access denied', 403));
      }

      if (!storage.enabled()) {
        log.error('profile upload blocked: MinIO disabled', null, { userId: id });
        return next(new AppError('Image storage is not configured. Please contact support.', 503));
      }

      const uploaded = await storage.uploadBuffer(
        'profiles',
        file.originalname,
        file.buffer,
        file.mimetype,
        { prefix: String(id) }
      );

      if (target.profile_image_url) {
        dropOldAvatarLegacy(target.profile_image_url).catch((e) =>
          log.warn('dropOldAvatarLegacy threw', { msg: e.message })
        );
      }

      target.profile_image_url = uploaded.publicUrl;
      await target.save();
      log.info('profile image updated for user', { adminId: req.user.id, userId: id, key: uploaded.key });
      return success(res, 'Profile image updated', { profileImageUrl: uploaded.publicUrl });
    } catch (err) {
      log.error('uploadProfileImageForUser failed', err, {
        targetUserId: req.params.id, adminId: req.user?.id
      });
      next(err);
    }
  }

  static async approve(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));

      const user = await User.findById(id);
      if (!user) return next(new AppError('User not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(user.organization_id, req.user.organizationId)) {
        return next(new AppError('You can only approve users from your organization', 403));
      }
      if (!canApproveRole(req.user.role, user.role)) {
        return next(new AppError('You cannot approve users with this role', 403));
      }

      user.status = 'active';
      await user.save();

      try {
        await NotificationService.notifyAdminUserApproved(user.organization_id, {
          id: String(user._id),
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        });
      } catch (e) {
        console.error('Failed to send user-approved notification:', e.message);
      }

      return success(res, 'User approved successfully');
    } catch (err) {
      next(err);
    }
  }

  static async suspend(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));

      const user = await User.findById(id);
      if (!user) return next(new AppError('User not found', 404));

      if (equalIds(req.user.id, user._id)) {
        return next(new AppError('You cannot deactivate your own account', 403));
      }

      const targetRole = (user.role || '').toString().toLowerCase();
      const requesterRole = (req.user.role || '').toString().toLowerCase();

      if (targetRole.includes('admin') && requesterRole !== 'superadmin') {
        return next(new AppError('Only a superadmin can deactivate an admin account', 403));
      }

      if (req.user.role !== 'superadmin' && !equalIds(user.organization_id, req.user.organizationId)) {
        return next(new AppError('You do not have permission to suspend users from other organizations', 403));
      }

      const unassignResult = await AmbulanceAssignment.deleteMany({ user_id: id });

      user.status = 'suspended';
      await user.save();

      return success(res, 'User suspended successfully', {
        userId: id,
        unassignedAmbulances: unassignResult.deletedCount || 0
      });
    } catch (err) {
      next(err);
    }
  }

  static async activate(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));

      const user = await User.findById(id);
      if (!user) return next(new AppError('User not found', 404));
      if (user.status !== 'suspended') {
        return next(new AppError('Only suspended users can be activated', 400));
      }

      const targetRole = (user.role || '').toString().toLowerCase();
      const requesterRole = (req.user.role || '').toString().toLowerCase();

      if (targetRole.includes('admin') && requesterRole !== 'superadmin') {
        return next(new AppError('Only a superadmin can activate admin accounts', 403));
      }

      if (req.user.role !== 'superadmin' && !equalIds(user.organization_id, req.user.organizationId)) {
        return next(new AppError('You do not have permission to activate users from other organizations', 403));
      }

      user.status = 'active';
      await user.save();
      return success(res, 'User activated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid user id', 400));

      const user = await User.findById(id);
      if (!user) return next(new AppError('User not found', 404));

      if (req.user.role !== 'superadmin' && !equalIds(user.organization_id, req.user.organizationId)) {
        return next(new AppError('Access denied', 403));
      }

      await user.deleteOne();
      return success(res, 'User deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
