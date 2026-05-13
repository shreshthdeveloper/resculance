const mongoose = require('mongoose');

const { Schema } = mongoose;

const CollaborationRequestSchema = new Schema(
  {
    hospital_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fleet_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    request_type: {
      type: String,
      enum: ['partnership', 'one_time', 'emergency'],
      default: 'partnership'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true
    },
    message: { type: String },
    terms: { type: String },
    requested_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    approved_at: { type: Date },
    rejected_reason: { type: String }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'collaboration_requests'
  }
);

CollaborationRequestSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
CollaborationRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CollaborationRequest', CollaborationRequestSchema);
