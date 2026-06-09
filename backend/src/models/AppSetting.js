const mongoose = require('mongoose');

/**
 * Generic key/value store for global application settings that aren't tied to
 * a specific organization or user. Currently used to hold the public
 * session-sharing config (enable flag + hashed PIN), managed by superadmins.
 */
const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSetting', appSettingSchema);
