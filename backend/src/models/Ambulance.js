const mongoose = require('mongoose');

const { Schema } = mongoose;

const AmbulanceSchema = new Schema(
  {
    organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ambulance_code: { type: String, required: true, unique: true, trim: true },
    registration_number: { type: String, required: true, unique: true, trim: true, index: true },
    vehicle_model: { type: String },
    vehicle_type: { type: String, enum: ['BLS', 'ALS', 'SCU'], required: true },
    status: {
      type: String,
      enum: [
        'pending_approval', 'active', 'inactive', 'maintenance',
        'available', 'on_trip', 'emergency', 'disabled', 'en_route', 'suspended'
      ],
      default: 'pending_approval',
      index: true
    },
    current_location_lat: { type: Number },
    current_location_lng: { type: Number },
    current_hospital_id: { type: Schema.Types.ObjectId, ref: 'Organization' },
    last_location_update: { type: Date },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'ambulances'
  }
);

AmbulanceSchema.index({ current_location_lat: 1, current_location_lng: 1 });

AmbulanceSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
AmbulanceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Ambulance', AmbulanceSchema);
