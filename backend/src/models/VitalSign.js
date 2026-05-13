const mongoose = require('mongoose');

const { Schema } = mongoose;

const VitalSignSchema = new Schema(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    session_id: { type: Schema.Types.ObjectId, ref: 'PatientSession', index: true },

    heart_rate: { type: Number },
    blood_pressure_systolic: { type: Number },
    blood_pressure_diastolic: { type: Number },
    temperature: { type: Number },
    respiratory_rate: { type: Number },
    oxygen_saturation: { type: Number },
    blood_glucose: { type: Number },
    consciousness_level: { type: String, enum: ['alert', 'verbal', 'pain', 'unresponsive'] },
    pain_scale: { type: Number, min: 0, max: 10 },
    notes: { type: String },

    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recorded_at: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: false,
    collection: 'vital_signs'
  }
);

VitalSignSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
VitalSignSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('VitalSign', VitalSignSchema);
