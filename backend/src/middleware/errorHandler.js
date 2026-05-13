const { AppError } = require('./auth');
const logger = require('../utils/logger').child('http');

// Multer surfaces upload-specific failures with a distinctive code. Map
// them to clean 4xx responses so the client sees "File too large" instead
// of an opaque 500.
const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'Uploaded file is too large.',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
  LIMIT_PART_COUNT: 'Too many parts in the upload.',
  LIMIT_FILE_COUNT: 'Too many files.',
  LIMIT_FIELD_KEY: 'Field name is too long.',
  LIMIT_FIELD_VALUE: 'Field value is too long.',
  LIMIT_FIELD_COUNT: 'Too many fields.'
};

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let error = err;
  let statusCode = err.statusCode || 500;

  // Mongo duplicate key
  if (err.code === 11000) {
    const fieldName = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const keyMap = {
      registration_number: 'registration number',
      email: 'email',
      contact_email: 'email',
      phone: 'phone number',
      contact_phone: 'phone number',
      organization_id: 'organization',
      code: 'code',
      ambulance_code: 'ambulance code',
      patient_code: 'patient code',
      session_code: 'session code',
      name: 'name',
      username: 'username',
      token: 'token'
    };
    const friendly = keyMap[fieldName] || fieldName.replace(/_/g, ' ');
    const label = friendly.charAt(0).toUpperCase() + friendly.slice(1);
    error = new AppError(`Duplicate value for ${label}. Please use another value.`, 400);
    statusCode = 400;
  }

  // Mongoose CastError (bad ObjectId)
  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
    statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    error = new AppError(`Invalid input data: ${messages.join(', ')}`, 400);
    statusCode = 400;
  }

  // Multer errors (file too large, wrong field, etc.). `err.name` is
  // 'MulterError' regardless of the specific failure.
  if (err.name === 'MulterError') {
    const friendly = MULTER_MESSAGES[err.code] || err.message || 'Upload failed';
    error = new AppError(friendly, 400);
    statusCode = 400;
  }

  // JWT errors (backup — auth middleware handles them first)
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401);
    statusCode = 401;
  }

  // Log every error with consistent shape. 5xx and unexpected ones get
  // the full stack; 4xx are noisy operational events so we log them at
  // `warn` without the stack to keep the signal-to-noise ratio sane.
  const logMeta = {
    method: req.method,
    path: req.originalUrl || req.path,
    statusCode,
    userId: req.user?.id || null
  };
  if (statusCode >= 500) {
    logger.error('request failed', err, logMeta);
  } else if (statusCode >= 400) {
    logger.warn('request rejected', { ...logMeta, msg: error.message, code: err.code });
  }

  const message = (statusCode >= 500 && process.env.NODE_ENV === 'production')
    ? 'Internal Server Error'
    : (error.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    error: message,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack
    })
  });
};

module.exports = errorHandler;
