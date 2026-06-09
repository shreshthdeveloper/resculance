const express = require('express');
const SettingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Public session-sharing config is global and only superadmins manage it.
router.get('/public-share', authorize('superadmin'), SettingsController.getPublicShareConfig);
router.put('/public-share', authorize('superadmin'), SettingsController.updatePublicShareConfig);

module.exports = router;
