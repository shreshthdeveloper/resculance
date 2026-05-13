const mongoose = require('mongoose');

const { Schema } = mongoose;

const PatientSessionSchema = new Schema(
  {
    session_code: { type: String, required: true, unique: true, trim: true, index: true },
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    ambulance_id: { type: Schema.Types.ObjectId, ref: 'Ambulance', required: true, index: true },
    organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

    status: {
      type: String,
      enum: ['onboarded', 'in_transit', 'offboarded', 'cancelled'],
      default: 'onboarded',
      index: true
    },

    pickup_location: { type: String },
    pickup_latitude: { type: Number },
    pickup_longitude: { type: Number },

    destination_hospital_id: { type: Schema.Types.ObjectId, ref: 'Organization' },
    destination_location: { type: String },
    destination_latitude: { type: Number },
    destination_longitude: { type: Number },

    chief_complaint: { type: String },
    initial_assessment: { type: String },
    treatment_notes: { type: String },
    outcome_status: { type: String, enum: ['stable', 'improved', 'critical', 'deceased'] },

    onboarded_at: { type: Date, default: Date.now },
    offboarded_at: { type: Date },
    onboarded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offboarded_by: { type: Schema.Types.ObjectId, ref: 'User' },

    estimated_arrival_time: { type: Date },
    actual_arrival_time: { type: Date },
    distance_km: { type: Number },
    duration_minutes: { type: Number },

    // Mongo: rich JSON metadata can live directly on the doc.
    // NOTE: Schema.Types.Mixed does NOT auto-track changes. If you mutate
    // session_metadata on a loaded document and `save()` it, the change
    // won't persist unless you call `doc.markModified('session_metadata')`
    // first. Prefer `findByIdAndUpdate(...)` for writes so this isn't a
    // foot-gun.
    session_metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'patient_sessions'
  }
);

PatientSessionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
PatientSessionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PatientSession', PatientSessionSchema);
