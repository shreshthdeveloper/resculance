const bcrypt = require('bcryptjs');
const { AppSetting } = require('../models');
const { AppError } = require('../middleware/auth');
const { success } = require('../utils/response');

const PUBLIC_SHARE_KEY = 'public_share';

/**
 * Read the public-share config from the settings store, normalising to a
 * predictable shape. Shared by the settings endpoints and the public session
 * endpoint so PIN verification lives in one place.
 */
async function getPublicShareSetting() {
  const doc = await AppSetting.findOne({ key: PUBLIC_SHARE_KEY }).lean();
  const value = doc?.value || {};
  return {
    enabled: !!value.enabled,
    // Default to requiring a PIN when the flag was never set, so existing
    // configs stay locked down rather than silently going open.
    requirePin: value.requirePin === undefined ? true : !!value.requirePin,
    pinHash: value.pinHash || null
  };
}

/**
 * Verify a plaintext PIN against the stored config. Returns one of:
 *   'ok' | 'disabled' | 'no_pin' | 'invalid'
 */
async function verifyPublicSharePin(pin) {
  const setting = await getPublicShareSetting();
  if (!setting.enabled) return 'disabled';
  // Sharing on, no PIN required → open to anyone with the link.
  if (!setting.requirePin) return 'ok';
  if (!setting.pinHash) return 'no_pin';
  if (!pin) return 'invalid';
  const match = await bcrypt.compare(String(pin), setting.pinHash);
  return match ? 'ok' : 'invalid';
}

class SettingsController {
  // GET /settings/public-share  (superadmin)
  static async getPublicShareConfig(req, res, next) {
    try {
      const setting = await getPublicShareSetting();
      return success(res, 'OK', {
        enabled: setting.enabled,
        requirePin: setting.requirePin,
        hasPin: !!setting.pinHash
      });
    } catch (err) {
      next(err);
    }
  }

  // PUT /settings/public-share  (superadmin)
  // Body: { enabled?: boolean, requirePin?: boolean, pin?: string }
  // - `enabled` toggles the whole feature on/off.
  // - `requirePin` toggles whether viewers must enter the PIN.
  // - `pin` (when a non-empty string) replaces the stored PIN.
  static async updatePublicShareConfig(req, res, next) {
    try {
      const { enabled, requirePin, pin } = req.body || {};

      const current = await getPublicShareSetting();
      const updated = {
        enabled: current.enabled,
        requirePin: current.requirePin,
        pinHash: current.pinHash
      };

      if (typeof enabled === 'boolean') updated.enabled = enabled;
      if (typeof requirePin === 'boolean') updated.requirePin = requirePin;

      // Validate + hash a new PIN if one was supplied.
      const hasNewPin = pin !== undefined && pin !== null && String(pin).trim() !== '';
      if (hasNewPin) {
        const trimmed = String(pin).trim();
        if (trimmed.length < 4 || trimmed.length > 32) {
          return next(new AppError('PIN must be between 4 and 32 characters', 400));
        }
        updated.pinHash = await bcrypt.hash(trimmed, 10);
      }

      // If a PIN is required, one must actually exist.
      if (updated.enabled && updated.requirePin && !updated.pinHash) {
        return next(new AppError('Set a PIN before requiring it, or turn off "Require access PIN"', 400));
      }

      await AppSetting.findOneAndUpdate(
        { key: PUBLIC_SHARE_KEY },
        { $set: { value: updated } },
        { upsert: true, new: true }
      );

      return success(res, 'Public sharing settings updated', {
        enabled: updated.enabled,
        requirePin: updated.requirePin,
        hasPin: !!updated.pinHash
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SettingsController;
module.exports.getPublicShareSetting = getPublicShareSetting;
module.exports.verifyPublicSharePin = verifyPublicSharePin;
