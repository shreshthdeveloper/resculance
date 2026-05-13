const { AuditLog } = require('../models');

/**
 * Lightweight audit helper used inside services/controllers.
 * Never throws.
 */
async function audit({ userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent }) {
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
    console.error('audit error:', err.message);
  }
}

module.exports = { audit };
