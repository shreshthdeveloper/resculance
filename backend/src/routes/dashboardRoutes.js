const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/stats', authenticate, DashboardController.getStats);

module.exports = router;
