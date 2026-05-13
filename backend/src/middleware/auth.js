const jwt = require('jsonwebtoken');
const { User, Ambulance, AmbulanceAssignment, Patient, PatientSession } = require('../models');
const { isValidId, equalIds } = require('../utils/ids');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const authenticate = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!isValidId(decoded.id)) {
      return next(new AppError('Invalid token payload.', 401));
    }

    const user = await User.findById(decoded.id)
      .populate('organization_id', 'name code type status is_active')
      .lean();

    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (!['active', 'pending_approval'].includes(user.status)) {
      return next(new AppError('Your account is not active. Please contact your administrator.', 403));
    }

    if (user.status === 'suspended') {
      return next(new AppError('Your account has been suspended. Please contact your administrator.', 403));
    }

    const org = user.organization_id || {};
    if (org.status !== 'active' || org.is_active === false) {
      return next(new AppError('Your organization is currently inactive. Please contact support.', 403));
    }

    req.user = {
      id: String(user._id),
      username: user.username,
      email: user.email,
      role: user.role ? user.role.toString().toLowerCase() : user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      profileImageUrl: user.profile_image_url || null,
      organizationId: String(org._id),
      organizationType: org.type,
      organizationCode: org.code,
      organizationName: org.name
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Not authenticated.', 401));
    if (req.user.role === 'superadmin') return next();
    const normalized = roles.map((r) => String(r).toLowerCase());
    if (!normalized.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

const requireOrgType = (...orgTypes) => {
  return (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') return next();
    if (!orgTypes.includes(req.user.organizationType)) {
      return next(new AppError('This action is not available for your organization type.', 403));
    }
    next();
  };
};

const canManageOrganization = async (req, res, next) => {
  try {
    const targetOrgId = req.params.orgId || req.params.organizationId || req.body.organizationId;
    if (req.user.role === 'superadmin') return next();
    if (!equalIds(targetOrgId, req.user.organizationId)) {
      return next(new AppError('You can only manage your own organization.', 403));
    }
    next();
  } catch (error) {
    next(error);
  }
};

const canAccessAmbulance = async (req, res, next) => {
  try {
    const ambulanceId = req.params.ambulanceId || req.body.ambulanceId;
    if (!ambulanceId) return next(new AppError('Ambulance ID is required.', 400));
    if (req.user.role === 'superadmin') {
      req.ambulance = await Ambulance.findById(ambulanceId).lean();
      if (!req.ambulance) return next(new AppError('Ambulance not found.', 404));
      return next();
    }

    if (!isValidId(ambulanceId)) {
      return next(new AppError('Invalid ambulance id.', 400));
    }

    const ambulance = await Ambulance.findById(ambulanceId).lean();
    if (!ambulance) return next(new AppError('Ambulance not found.', 404));

    const isOwnedByOrg = equalIds(ambulance.organization_id, req.user.organizationId);
    let isAssigned = false;
    if (!isOwnedByOrg) {
      const assignment = await AmbulanceAssignment.findOne({
        ambulance_id: ambulance._id,
        user_id: req.user.id,
        is_active: true
      }).lean();
      isAssigned = !!assignment;
    }

    if (!isOwnedByOrg && !isAssigned) {
      return next(new AppError('You do not have access to this ambulance.', 403));
    }

    req.ambulance = ambulance;
    next();
  } catch (error) {
    next(error);
  }
};

const canAccessPatient = async (req, res, next) => {
  try {
    const patientCode = req.params.patientCode || req.body.patientCode;
    if (!patientCode) return next(new AppError('Patient code is required.', 400));
    if (req.user.role === 'superadmin') return next();

    const patient = await Patient.findOne({ patient_code: patientCode }).lean();
    if (!patient) return next(new AppError('Patient not found.', 404));

    // Patient must either belong to user's org, or there must be a session linking them to it.
    let allowed = equalIds(patient.organization_id, req.user.organizationId);
    if (!allowed) {
      const session = await PatientSession.findOne({
        patient_id: patient._id,
        organization_id: req.user.organizationId
      }).lean();
      allowed = !!session;
    }

    if (!allowed) {
      return next(new AppError('You do not have access to this patient.', 404));
    }

    if (patient.is_data_hidden &&
        !['hospital_admin', 'hospital_staff', 'fleet_admin', 'fleet_staff'].includes(req.user.role)) {
      return next(new AppError('Access to this patient data is restricted.', 403));
    }

    req.patient = patient;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  authorize,
  requireOrgType,
  canManageOrganization,
  canAccessAmbulance,
  canAccessPatient,
  AppError
};
