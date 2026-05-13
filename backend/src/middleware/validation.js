const { body, param, validationResult } = require('express-validator');
const { AppError } = require('./auth');
const { isValidId } = require('../utils/ids');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg).join(', ');
    return next(new AppError(errorMessages, 400));
  }
  next();
};

// Custom validator for Mongo ObjectId strings
const mongoId = (value) => {
  if (!isValidId(value)) throw new Error('Valid ID is required');
  return true;
};

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').optional().trim(),
  body('role').notEmpty().withMessage('Role is required'),
  body('organizationId')
    .if((value, { req }) => {
      const role = (req.body.role || '').toString().toLowerCase();
      return role !== 'superadmin';
    })
    .custom(mongoId)
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
];

const createOrganizationValidation = [
  body('name').trim().notEmpty().withMessage('Organization name is required'),
  body('type')
    .notEmpty()
    .withMessage('Organization type is required')
    .isIn(['hospital', 'fleet_owner', 'HOSPITAL', 'FLEET_OWNER'])
    .withMessage('Invalid organization type. Must be hospital or fleet_owner')
    .customSanitizer((value) => value.toLowerCase()),
  body('email').optional().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('phone').optional().trim(),
  body('address').optional().trim()
];

const createAmbulanceValidation = [
  body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
  body('vehicleModel').optional().trim(),
  body('vehicleType').optional().trim(),
  body('organizationId').custom(mongoId)
];

const createPatientValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').optional().trim(),
  body('age').optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 150 }).withMessage('Age must be between 0 and 150'),
  body('gender').optional({ nullable: true, checkFalsy: true })
    .isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
  body('bloodGroup').optional().trim(),
  body('phone').optional().trim()
];

const onboardPatientValidation = [
  body('ambulanceId').custom(mongoId),
  body('destinationHospitalId').custom(mongoId),
  body('chiefComplaint').optional().trim(),
  body('pickupLocation').optional().trim()
];

const createCollaborationRequestValidation = [
  body().custom((_, { req }) => {
    const fleetId = req.body.fleetId;
    if (!fleetId) throw new Error('Fleet ID is required');
    if (!isValidId(fleetId)) throw new Error('Valid Fleet ID is required');

    if (req.user && req.user.role && req.user.role.toString().toLowerCase() === 'superadmin') {
      const hospitalId = req.body.hospitalId;
      if (!hospitalId) throw new Error('Hospital ID is required for superadmin-created partnerships');
      if (!isValidId(hospitalId)) throw new Error('Valid Hospital ID is required');
    }
    return true;
  }),
  body('message').optional().trim()
];

const idParamValidation = [param('id').custom(mongoId)];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  changePasswordValidation,
  createOrganizationValidation,
  createAmbulanceValidation,
  createPatientValidation,
  onboardPatientValidation,
  createCollaborationRequestValidation,
  idParamValidation
};
