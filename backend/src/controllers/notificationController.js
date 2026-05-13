const { Notification } = require('../models');
const { AppError } = require('../middleware/auth');
const { isValidId } = require('../utils/ids');
const { success } = require('../utils/response');
const log = require('../utils/logger').child('notification');

// All endpoints return the standard `{ success, message, data }` envelope.
// Previously these used bare `res.json({...})` which forced every client
// to special-case the notifications API. Normalised here for consistency.
class NotificationController {
  static async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit, 10) || 50;
      const notifications = await Notification.find({ user_id: userId })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();
      return success(res, 'OK', { notifications });
    } catch (err) {
      log.error('getNotifications failed', err, { userId: req.user?.id });
      next(err);
    }
  }

  static async getUnreadNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const notifications = await Notification.find({ user_id: userId, is_read: false })
        .sort({ created_at: -1 })
        .lean();
      return success(res, 'OK', { notifications });
    } catch (err) {
      log.error('getUnreadNotifications failed', err, { userId: req.user?.id });
      next(err);
    }
  }

  static async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await Notification.countDocuments({ user_id: userId, is_read: false });
      return success(res, 'OK', { count });
    } catch (err) {
      log.error('getUnreadCount failed', err, { userId: req.user?.id });
      next(err);
    }
  }

  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));
      await Notification.findOneAndUpdate(
        { _id: id, user_id: req.user.id },
        { is_read: true, read_at: new Date() }
      );
      return success(res, 'Notification marked as read');
    } catch (err) {
      log.error('markAsRead failed', err, { id: req.params.id });
      next(err);
    }
  }

  static async markAllAsRead(req, res, next) {
    try {
      await Notification.updateMany(
        { user_id: req.user.id, is_read: false },
        { is_read: true, read_at: new Date() }
      );
      return success(res, 'All notifications marked as read');
    } catch (err) {
      log.error('markAllAsRead failed', err, { userId: req.user?.id });
      next(err);
    }
  }

  static async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid id', 400));
      await Notification.findOneAndDelete({ _id: id, user_id: req.user.id });
      return success(res, 'Notification deleted');
    } catch (err) {
      log.error('deleteNotification failed', err, { id: req.params.id });
      next(err);
    }
  }

  static async deleteAllNotifications(req, res, next) {
    try {
      await Notification.deleteMany({ user_id: req.user.id });
      return success(res, 'All notifications deleted');
    } catch (err) {
      log.error('deleteAllNotifications failed', err, { userId: req.user?.id });
      next(err);
    }
  }
}

module.exports = NotificationController;
