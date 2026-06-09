const express = require('express');
const SessionController = require('../controllers/sessionController');

const router = express.Router();

// Public, PIN-gated read-only session view. Deliberately NOT behind
// `authenticate` — access is controlled by the superadmin-managed share PIN
// (see settingsController). POST so the PIN travels in the body, not the URL.
router.post('/sessions/:sessionId', SessionController.getPublicSessionMetadata);

module.exports = router;
