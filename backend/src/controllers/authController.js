const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const { User, Organization } = require('../models');
const { AppError } = require('../middleware/auth');
const { success } = require('../utils/response');
const { isValidId } = require('../utils/ids');
const { normalizeRole } = require('../utils/roleUtils');
const storage = require('../services/storageService');
const log = require('../utils/logger').child('auth');

// Best-effort cleanup for a previously-stored avatar. New uploads live in
// MinIO under `profiles/...`; pre-migration ones referenced /uploads/profiles/*
// on the local disk. We tolerate both so old users can still get a fresh
// avatar without their previous file being orphaned.
async function dropOldAvatar(profileImageUrl) {
  if (!profileImageUrl) return;
  if (profileImageUrl.includes('/profiles/')) {
    // Heuristic: extract whatever follows the bucket name as the object key.
    // For legacy disk URLs (/uploads/profiles/<file>) we fall through to the
    // fs unlink branch.
    const cfg = storage.config();
    const bucketTag = `/${cfg.bucket}/profiles/`;
    const minioIdx = profileImageUrl.indexOf(bucketTag);
    if (minioIdx >= 0) {
      const key = profileImageUrl.slice(minioIdx + 1).split('?')[0];
      await storage.deleteObject(key).catch((e) => log.warn('avatar minio delete failed', { msg: e.message }));
      return;
    }
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

function signAccessToken(user) {
  return jwt.sign(
    {
      id: String(user._id),
      role: user.role,
      organizationId: String(user.organization_id?._id || user.organization_id),
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: String(user._id) },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
}

function serializeUserForLoginResponse(user, org) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    profileImageUrl: user.profile_image_url || null,
    role: user.role,
    organization: org
      ? { id: String(org._id), name: org.name, code: org.code, type: org.type }
      : null
  };
}

class AuthController {
  static async register(req, res, next) {
    try {
      const { email, username, password, firstName, lastName, role, organizationId, phone } = req.body;

      if (await User.findOne({ email })) return next(new AppError('Email already registered', 400));
      if (await User.findOne({ username })) return next(new AppError('Username already taken', 400));

      const normalizedRole = await normalizeRole(role, undefined, organizationId);

      // Superadmin doesn't need org binding (uses the SYSTEM org if seeded)
      let orgRefId = organizationId;
      if (normalizedRole === 'superadmin' && !orgRefId) {
        const systemOrg = await Organization.findOne({ code: 'SYSTEM' });
        orgRefId = systemOrg?._id;
      }
      if (!orgRefId) return next(new AppError('Valid organization ID is required', 400));

      const user = await User.create({
        email,
        username,
        password,
        first_name: firstName,
        last_name: lastName,
        role: normalizedRole,
        organization_id: orgRefId,
        phone,
        status: 'pending_approval',
        created_by: req.user?.id
      });

      return success(res, 'User registered successfully. Awaiting approval.', { userId: String(user._id) }, 201);
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email })
        .select('+password')
        .populate('organization_id', 'name code type status is_active');

      if (!user) return next(new AppError('Invalid email or password', 401));

      const isValid = await user.comparePassword(password);
      if (!isValid) return next(new AppError('Invalid email or password', 401));

      if (user.status === 'suspended') {
        return next(new AppError('Your account has been suspended. Please contact your administrator.', 403));
      }
      if (user.status !== 'active') {
        return next(new AppError('Your account is not active. Please contact administrator.', 403));
      }

      user.last_login = new Date();
      await user.save({ validateModifiedOnly: true });

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      return success(res, 'Login successful', {
        user: serializeUserForLoginResponse(user, user.organization_id),
        accessToken,
        refreshToken
      });
    } catch (err) {
      next(err);
    }
  }

  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return next(new AppError('Refresh token is required', 400));

      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (!isValidId(decoded.id)) return next(new AppError('Invalid refresh token', 401));

      const user = await User.findById(decoded.id).populate('organization_id', 'name code type');
      if (!user) return next(new AppError('User not found', 404));
      if (user.status !== 'active') return next(new AppError('Your account is not active', 403));

      const accessToken = signAccessToken(user);
      return success(res, 'Token refreshed successfully', { accessToken });
    } catch (err) {
      if (err.name === 'JsonWebTokenError') return next(new AppError('Invalid refresh token', 401));
      if (err.name === 'TokenExpiredError') return next(new AppError('Refresh token has expired. Please log in again.', 401));
      next(err);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) return next(new AppError('Email is required', 400));

      const user = await User.findOne({ email });
      if (!user) {
        // Don't reveal whether the address exists
        console.warn(`forgot-password requested for unknown email: ${email}`);
        return success(res, 'If an account exists with that email, you will receive a reset link.');
      }

      const resetToken = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
      console.log(`[dev] password reset token for ${email}: ${resetToken}`);

      return success(res, 'If an account exists with that email, you will receive a reset link.');
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id).populate('organization_id', 'name code type');
      if (!user) return next(new AppError('User not found', 404));

      const org = user.organization_id;
      const normalized = {
        id: String(user._id),
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        profileImageUrl: user.profile_image_url || null,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        organizationId: org ? String(org._id) : null,
        organizationName: org?.name,
        organizationCode: org?.code,
        organizationType: org?.type,
        createdAt: user.created_at,
        lastLogin: user.last_login
      };

      return success(res, 'OK', { user: normalized });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, phone } = req.body;
      const update = {};
      if (firstName !== undefined) update.first_name = firstName;
      if (lastName !== undefined) update.last_name = lastName;
      if (phone !== undefined) update.phone = phone;

      await User.findByIdAndUpdate(req.user.id, update);
      return success(res, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async uploadProfileImage(req, res, next) {
    try {
      const file = req.file;
      if (!file || !file.buffer) return next(new AppError('No file uploaded', 400));
      if (!storage.enabled()) {
        log.error('profile upload blocked: MinIO disabled', null, { userId: req.user.id });
        return next(new AppError('Image storage is not configured. Please contact support.', 503));
      }

      const uploaded = await storage.uploadBuffer(
        'profiles',
        file.originalname,
        file.buffer,
        file.mimetype,
        { prefix: String(req.user.id) }
      );

      const existing = await User.findById(req.user.id).select('profile_image_url').lean();
      if (existing?.profile_image_url) {
        // Don't await — best-effort cleanup, log failures but never block
        // the upload response on them.
        dropOldAvatar(existing.profile_image_url).catch((e) =>
          log.warn('dropOldAvatar threw', { msg: e.message })
        );
      }

      await User.findByIdAndUpdate(req.user.id, { profile_image_url: uploaded.publicUrl });
      log.info('profile image updated', { userId: req.user.id, key: uploaded.key });
      return success(res, 'Profile image uploaded', { profileImageUrl: uploaded.publicUrl });
    } catch (err) {
      log.error('uploadProfileImage failed', err, { userId: req.user?.id });
      next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return next(new AppError('Current password and new password are required', 400));
      }
      if (newPassword.length < 6) {
        return next(new AppError('New password must be at least 6 characters long', 400));
      }

      const user = await User.findById(req.user.id).select('+password');
      if (!user) return next(new AppError('User not found', 404));

      const ok = await user.comparePassword(currentPassword);
      if (!ok) return next(new AppError('Current password is incorrect', 400));

      user.password = newPassword;
      await user.save();
      return success(res, 'Password changed successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
