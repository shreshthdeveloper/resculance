const { hasPermission, canApproveRole, PERMISSIONS } = require('../config/permissions');
const { AppError } = require('./auth');
const { User } = require('../models');
const { equalIds, isValidId } = require('../utils/ids');

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (!hasPermission(req.user.role, permission)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  const hasAny = permissions.some((p) => hasPermission(req.user.role, p));
  if (!hasAny) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

const requireAllPermissions = (...permissions) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  const hasAll = permissions.every((p) => hasPermission(req.user.role, p));
  if (!hasAll) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

const restrictToOwnOrganization = (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (req.user.role === 'superadmin') return next();

  const targetOrgId =
    req.params.organizationId ||
    req.params.orgId ||
    req.body.organizationId ||
    req.query.organizationId;

  if (targetOrgId && !equalIds(targetOrgId, req.user.organizationId)) {
    return next(new AppError('Access denied: You can only access your own organization', 403));
  }
  next();
};

const canApproveUserRole = async (req, res, next) => {
  try {
    if (!req.user) return next(new AppError('Authentication required', 401));

    let targetRole = req.body.role || req.targetUser?.role;
    const approverRole = req.user.role;

    if (!targetRole) {
      const userId = req.params?.id;
      if (!userId || !isValidId(userId)) {
        return next(new AppError('Target user role not found', 400));
      }
      const targetUser = await User.findById(userId).lean();
      if (!targetUser) return next(new AppError('Target user not found', 404));
      req.targetUser = targetUser;
      targetRole = targetUser.role;
    }

    const a = approverRole ? String(approverRole).toLowerCase() : '';
    const t = targetRole ? String(targetRole).toLowerCase() : '';

    if (!canApproveRole(a, t)) {
      return next(new AppError('You cannot approve users with this role', 403));
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  restrictToOwnOrganization,
  canApproveUserRole,
  PERMISSIONS
};
