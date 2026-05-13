const mongoose = require('mongoose');

const { Schema } = mongoose;

const PatientSchema = new Schema(
  {
    organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    patient_code: { type: String, required: true, unique: true, trim: true, index: true },
    first_name: { type: String, required: true },
    last_name: { type: String },
    age: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    blood_group: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    phone: { type: String },
    contact_phone: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: 'India' },
    pincode: { type: String },
    emergency_contact_name: { type: String },
    emergency_contact_phone: { type: String },
    emergency_contact_relation: { type: String },
    medical_history: { type: String },
    allergies: { type: String },
    current_medications: { type: String },
    insurance_provider: { type: String },
    insurance_number: { type: String },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    is_active: { type: Boolean, default: true, index: true },

    // Denormalised flags (kept for fast "available patient" queries)
    is_onboarded: { type: Boolean, default: false, index: true },
    current_session_id: { type: Schema.Types.ObjectId, ref: 'PatientSession' },
    onboarded_at: { type: Date },

    // Data hiding (HIPAA-style)
    is_data_hidden: { type: Boolean, default: false },
    hidden_by: { type: Schema.Types.ObjectId, ref: 'User' },
    hidden_at: { type: Date }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'patients'
  }
);

PatientSchema.index({ first_name: 1, last_name: 1 });

PatientSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
PatientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Patient', PatientSchema);
