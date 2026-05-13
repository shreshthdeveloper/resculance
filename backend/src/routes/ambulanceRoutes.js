const express = require('express');
const AmbulanceController = require('../controllers/ambulanceController');
const AmbulanceDeviceController = require('../controllers/ambulanceDeviceController');
const { authenticate, authorize } = require('../middleware/auth');
const { createAmbulanceValidation, validate } = require('../middleware/validation');
const { requirePermission, requireAnyPermission } = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);

router.post('/', requirePermission(PERMISSIONS.CREATE_AMBULANCE), createAmbulanceValidation, validate, AmbulanceController.create);

router.get('/',
  requireAnyPermission(
    PERMISSIONS.VIEW_ALL_AMBULANCES,
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.VIEW_PARTNERED_AMBULANCES
  ),
  AmbulanceController.getAll
);

router.get('/for-user/:userId', AmbulanceController.getAmbulancesForUser);
router.get('/my-ambulances', AmbulanceController.getUserAmbulances);

// Device API proxy endpoints — must come before generic /:id routes
router.get('/devices/:id/location', AmbulanceDeviceController.getDeviceLocation);
router.get('/devices/:id/stream', AmbulanceDeviceController.getDeviceStream);
router.get('/devices/:id/data', AmbulanceDeviceController.getDeviceData);
router.post('/devices/:id/authenticate', AmbulanceDeviceController.authenticate);

router.put('/devices/:id',
  authorize(ROLES.SUPERADMIN, ROLES.FLEET_ADMIN, ROLES.FLEET_STAFF, ROLES.HOSPITAL_ADMIN, ROLES.HOSPITAL_STAFF),
  AmbulanceDeviceController.update
);
router.delete('/devices/:id',
  authorize(ROLES.SUPERADMIN, ROLES.FLEET_ADMIN, ROLES.HOSPITAL_ADMIN),
  AmbulanceDeviceController.delete
);
router.get('/devices/:id', AmbulanceDeviceController.getById);

// Nested device routes
router.post('/:ambulanceId/devices',
  authorize(ROLES.SUPERADMIN, ROLES.FLEET_ADMIN, ROLES.FLEET_STAFF, ROLES.HOSPITAL_ADMIN, ROLES.HOSPITAL_STAFF),
  AmbulanceDeviceController.create
);
router.get('/:ambulanceId/devices', AmbulanceDeviceController.getByAmbulance);
router.get('/:ambulanceId/devices/location', AmbulanceDeviceController.getAmbulanceDevicesLocation);

// Ambulance instance routes
router.get('/:id', AmbulanceController.getById);
router.put('/:id', requirePermission(PERMISSIONS.UPDATE_AMBULANCE), AmbulanceController.update);
router.patch('/:id/approve', requirePermission(PERMISSIONS.APPROVE_AMBULANCE), AmbulanceController.approve);
router.post('/:id/assign', requirePermission(PERMISSIONS.ASSIGN_STAFF), AmbulanceController.assignUser);
router.delete('/:id/unassign/:userId', requirePermission(PERMISSIONS.ASSIGN_STAFF), AmbulanceController.unassignUser);
router.get('/:id/assigned-users', AmbulanceController.getAssignedUsers);
router.post('/:id/location', AmbulanceController.updateLocation);
router.delete('/:id', authorize(ROLES.SUPERADMIN, ROLES.HOSPITAL_ADMIN, ROLES.FLEET_ADMIN), AmbulanceController.delete);
router.patch('/:id/deactivate', authorize(ROLES.SUPERADMIN), AmbulanceController.deactivate);
router.patch('/:id/activate', authorize(ROLES.SUPERADMIN), AmbulanceController.activate);

module.exports = router;
