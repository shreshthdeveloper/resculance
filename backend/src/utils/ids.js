const mongoose = require('mongoose');

const { Types } = mongoose;

function isValidId(value) {
  return Types.ObjectId.isValid(value);
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof Types.ObjectId) return value;
  if (!isValidId(value)) return null;
  return new Types.ObjectId(String(value));
}

/**
 * Compare two ids regardless of whether they're ObjectId, strings, or mixed.
 */
function equalIds(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

module.exports = { isValidId, toObjectId, equalIds };
