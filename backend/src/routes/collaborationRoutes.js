const express = require('express');
const CollaborationController = require('../controllers/collaborationController');
const { authenticate, authorize } = require('../middleware/auth');
const { createCollaborationRequestValidation, validate } = require('../middleware/validation');
const { ROLES } = require('../config/constants');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.HOSPITAL_STAFF, ROLES.FLEET_ADMIN, ROLES.FLEET_STAFF),
  createCollaborationRequestValidation,
  validate,
  CollaborationController.create
);

router.get('/', CollaborationController.getAll);
router.get('/partnerships/my', CollaborationController.getMyPartnerships);
router.get('/:id', CollaborationController.getById);

router.patch('/:id/accept',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.HOSPITAL_STAFF, ROLES.FLEET_ADMIN, ROLES.FLEET_STAFF),
  CollaborationController.accept
);
router.patch('/:id/reject',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.HOSPITAL_STAFF, ROLES.FLEET_ADMIN, ROLES.FLEET_STAFF),
  CollaborationController.reject
);
router.patch('/:id/cancel',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.HOSPITAL_STAFF, ROLES.FLEET_ADMIN, ROLES.FLEET_STAFF),
  CollaborationController.cancel
);

module.exports = router;
