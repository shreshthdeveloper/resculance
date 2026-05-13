const express = require('express');

const authRoutes = require('./authRoutes');
const organizationRoutes = require('./organizationRoutes');
const userRoutes = require('./userRoutes');
const ambulanceRoutes = require('./ambulanceRoutes');
const patientRoutes = require('./patientRoutes');
const collaborationRoutes = require('./collaborationRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const activityRoutes = require('./activityRoutes');
const notificationRoutes = require('./notificationRoutes');
const sessionRoutes = require('./sessions');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/users', userRoutes);
router.use('/ambulances', ambulanceRoutes);
router.use('/patients', patientRoutes);
router.use('/collaborations', collaborationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/activities', activityRoutes);
router.use('/notifications', notificationRoutes);
router.use('/sessions', sessionRoutes);

module.exports = router;
