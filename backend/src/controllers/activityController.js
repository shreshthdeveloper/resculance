const { ActivityLog } = require('../models');
const { hasPermission, PERMISSIONS } = require('../config/permissions');
const { isValidId } = require('../utils/ids');

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

class ActivityController {
  static async getAll(req, res) {
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

      res.json({
        activities,
        pagination: {
          page, limit, total, totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      res.status(500).json({ error: 'Failed to fetch activity logs', message: err.message });
    }
  }

  static async getActivityTypes(req, res) {
    try {
      const activities = await ActivityLog.distinct('activity');
      activities.sort();
      res.json({ activities });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch activity types', message: err.message });
    }
  }

  static async getUsers(req, res) {
    try {
      const rows = await ActivityLog.aggregate([
        { $group: { _id: '$user_id', user_name: { $first: '$user_name' } } },
        { $sort: { user_name: 1 } }
      ]);
      const users = rows.map((r) => ({ user_id: r._id ? String(r._id) : null, user_name: r.user_name }));
      res.json({ users });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users', message: err.message });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
      const activity = await ActivityLog.findById(id).lean();
      if (!activity) return res.status(404).json({ error: 'Activity log not found' });
      res.json({ activity });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch activity log', message: err.message });
    }
  }
}

module.exports = ActivityController;
