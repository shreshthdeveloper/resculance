const mongoose = require('mongoose');

const { Schema } = mongoose;

const AmbulanceDeviceSchema = new Schema(
  {
    ambulance_id: { type: Schema.Types.ObjectId, ref: 'Ambulance', required: true, index: true },
    device_name: { type: String, required: true },
    device_type: {
      type: String,
      enum: ['CAMERA', 'LIVE_LOCATION', 'ECG', 'VITAL_MONITOR', 'GPS_TRACKER'],
      required: true,
      index: true
    },
    device_id: { type: String, required: true, index: true },
    device_username: { type: String },
    device_password: { type: String },
    device_api: { type: String },
    jsession: { type: String },
    manufacturer: { type: String },
    model: { type: String },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
      index: true
    },
    last_sync: { type: Date }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'ambulance_devices'
  }
);

AmbulanceDeviceSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
AmbulanceDeviceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AmbulanceDevice', AmbulanceDeviceSchema);
