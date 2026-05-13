const { Notification } = require('../models');
const { isValidId } = require('../utils/ids');

class NotificationController {
  static async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit, 10) || 50;
      const notifications = await Notification.find({ user_id: userId })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const notifications = await Notification.find({ user_id: userId, is_read: false })
        .sort({ created_at: -1 })
        .lean();
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  }

  static async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await Notification.countDocuments({ user_id: userId, is_read: false });
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }

  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return res.status(400).json({ message: 'Invalid id' });
      await Notification.findOneAndUpdate(
        { _id: id, user_id: req.user.id },
        { is_read: true, read_at: new Date() }
      );
      res.json({ message: 'Notification marked as read' });
    } catch (err) {
      next(err);
    }
  }

  static async markAllAsRead(req, res, next) {
    try {
      await Notification.updateMany(
        { user_id: req.user.id, is_read: false },
        { is_read: true, read_at: new Date() }
      );
      res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  }

  static async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return res.status(400).json({ message: 'Invalid id' });
      await Notification.findOneAndDelete({ _id: id, user_id: req.user.id });
      res.json({ message: 'Notification deleted' });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAllNotifications(req, res, next) {
    try {
      await Notification.deleteMany({ user_id: req.user.id });
      res.json({ message: 'All notifications deleted' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = NotificationController;
