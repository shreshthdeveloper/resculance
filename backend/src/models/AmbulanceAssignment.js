const mongoose = require('mongoose');

const { Schema } = mongoose;

const AmbulanceAssignmentSchema = new Schema(
  {
    ambulance_id: { type: Schema.Types.ObjectId, ref: 'Ambulance', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assigning_organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    assigned_by: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String },
    assigned_at: { type: Date, default: Date.now },
    is_active: { type: Boolean, default: true, index: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'ambulance_assignments'
  }
);

// Unique (ambulance, user, assigning_org) — matches the SQL composite key
AmbulanceAssignmentSchema.index(
  { ambulance_id: 1, user_id: 1, assigning_organization_id: 1 },
  { unique: true }
);

AmbulanceAssignmentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
AmbulanceAssignmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AmbulanceAssignment', AmbulanceAssignmentSchema);
