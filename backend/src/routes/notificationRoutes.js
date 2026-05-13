const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', NotificationController.getNotifications);
router.get('/unread', NotificationController.getUnreadNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);

// Static path before dynamic /:id
router.patch('/mark-all-read', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);

router.delete('/:id', NotificationController.deleteNotification);
router.delete('/', NotificationController.deleteAllNotifications);

module.exports = router;
