const { ActivityLog } = require('../models');
const { AppError } = require('../middleware/auth');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { isValidId } = require('../utils/ids');
const { success } = require('../utils/response');
const log = require('../utils/logger').child('activity');

function buildFilter({ activity, userId, organizationId, startDate, endDate, search }) {
  const filter = {};
  if (activity) filter.activity = activity;
  if (userId && isValidId(userId)) filter.user_id = userId;
  if (organizationId && isValidId(organizationId)) filter.organization_id = organizationId;
  if (startDate) filter.created_at = { ...(filter.created_at || {}), $gte: new Date(startDate) };
  if (endDate) filter.created_at = { ...(filter.created_at || {}), $lte: new Date(endDate) };
  if (search) {
    const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ comments: re }, { user_name: re }, { organization_name: re }];
  }
  return filter;
}

// All endpoints return the standard `{ success, message, data }` envelope.
// Previously these used bare `res.json({...})` shapes, which forced every
// client to special-case the activity-log endpoints. Normalised so the
// envelope contract is uniform across the API.
class ActivityController {
  static async getAll(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = (page - 1) * limit;

      const restrictedToOrg = !hasPermission(req.user?.role, PERMISSIONS.VIEW_ACTIVITY_LOGS);
      const filter = buildFilter({
        ...req.query,
        organizationId: restrictedToOrg ? req.user?.organizationId : req.query.organizationId
      });

      const [activities, total] = await Promise.all([
        ActivityLog.find(filter).sort({ created_at: -1 }).skip(offset).limit(limit).lean(),
        ActivityLog.countDocuments(filter)
      ]);

      return success(res, 'OK', {
        activities,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (err) {
      log.error('getAll failed', err, { userId: req.user?.id });
      next(err);
    }
  }

  static async getActivityTypes(req, res, next) {
    try {
      const activities = await ActivityLog.distinct('activity');
      activities.sort();
      return success(res, 'OK', { activities });
    } catch (err) {
      log.error('getActivityTypes failed', err);
      next(err);
    }
  }

  static async getUsers(req, res, next) {
    try {
      const rows = await ActivityLog.aggregate([
        { $group: { _id: '$user_id', user_name: { $first: '$user_name' } } },
        { $sort: { user_name: 1 } }
      ]);
      const users = rows.map((r) => ({ user_id: r._id ? String(r._id) : null, user_name: r.user_name }));
      return success(res, 'OK', { users });
    } catch (err) {
      log.error('getUsers failed', err);
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));
      const activity = await ActivityLog.findById(id).lean();
      if (!activity) return next(new AppError('Activity log not found', 404));
      return success(res, 'OK', { activity });
    } catch (err) {
      log.error('getById failed', err, { id: req.params.id });
      next(err);
    }
  }
}

module.exports = ActivityController;
