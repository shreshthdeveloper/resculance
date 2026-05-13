const { AuditLog } = require('../models');

/**
 * Best-effort audit logger. Never throws — logs the error and continues.
 */
async function auditLog(userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent) {
  try {
    await AuditLog.create({
      user_id: userId || undefined,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues || null,
      new_values: newValues || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null
    });
  } catch (err) {
    console.error('audit log error:', err.message);
  }
}

/**
 * Express middleware factory that records a row on successful (2xx) responses.
 */
function auditMiddleware(action, entityType) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entityId = req.params.id || req.params.organizationId || req.params.userId || null;
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        auditLog(req.user?.id, action, entityType, entityId, null, body, ip, req.headers['user-agent']);
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { auditLog, auditMiddleware };
