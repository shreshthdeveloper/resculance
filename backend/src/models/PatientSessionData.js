const mongoose = require('mongoose');

const { Schema } = mongoose;

const PatientSessionDataSchema = new Schema(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'PatientSession', required: true, index: true },
    data_type: { type: String, enum: ['note', 'medication', 'file'], required: true, index: true },
    content: { type: Schema.Types.Mixed, required: true },
    added_by: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    added_at: { type: Date, default: Date.now }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'patient_session_data'
  }
);

PatientSessionDataSchema.index({ session_id: 1, data_type: 1 });

PatientSessionDataSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
PatientSessionDataSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PatientSessionData', PatientSessionDataSchema);
