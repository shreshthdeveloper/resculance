const { AppError } = require('./auth');

const errorHandler = (err, req, res, next) => {
  let error = err;
  let statusCode = err.statusCode || 500;

  if (process.env.NODE_ENV === 'development') {
    console.error('Error Stack:', err.stack);
  } else {
    console.error('Error:', {
      message: err.message,
      statusCode,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

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

  // JWT errors (backup — auth middleware handles them first)
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401);
    statusCode = 401;
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
