const express = require('express');
const router = express.Router();
const ActivityController = require('../controllers/activityController');
const { authenticate } = require('../middleware/auth');
const { requireAnyPermission, PERMISSIONS } = require('../middleware/permissions');

router.use(authenticate);
router.use(requireAnyPermission(PERMISSIONS.VIEW_ACTIVITY_LOGS, PERMISSIONS.VIEW_DASHBOARD));

router.get('/', ActivityController.getAll);
router.get('/types', ActivityController.getActivityTypes);
router.get('/users', ActivityController.getUsers);
router.get('/:id', ActivityController.getById);

module.exports = router;
