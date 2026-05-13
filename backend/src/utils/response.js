/**
 * Standard response envelopes used by every controller.
 * Frontend axios layer expects: { success, message, data }
 */

function success(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message: message || 'OK',
    data: data === undefined ? null : data
  });
}

function error(res, message, statusCode = 400, errors = undefined) {
  const body = { success: false, message: message || 'Error' };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { success, error };
