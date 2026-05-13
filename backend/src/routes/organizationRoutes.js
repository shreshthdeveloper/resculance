const express = require('express');
const OrganizationController = require('../controllers/organizationController');
const { authenticate } = require('../middleware/auth');
const { createOrganizationValidation, validate } = require('../middleware/validation');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  requirePermission(PERMISSIONS.CREATE_ORGANIZATION),
  createOrganizationValidation,
  validate,
  OrganizationController.create
);

router.get('/', OrganizationController.getAll);
router.get('/:id', OrganizationController.getById);

router.put('/:id', requirePermission(PERMISSIONS.UPDATE_ORGANIZATION), OrganizationController.update);
router.delete('/:id', requirePermission(PERMISSIONS.DELETE_ORGANIZATION), OrganizationController.delete);

router.patch('/:id/deactivate', requirePermission(PERMISSIONS.UPDATE_ORGANIZATION), OrganizationController.deactivate);
router.patch('/:id/suspend', requirePermission(PERMISSIONS.UPDATE_ORGANIZATION), OrganizationController.suspend);
router.patch('/:id/activate', requirePermission(PERMISSIONS.UPDATE_ORGANIZATION), OrganizationController.activate);

module.exports = router;
