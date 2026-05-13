const mongoose = require('mongoose');

const { Schema } = mongoose;

const ActivityLogSchema = new Schema(
  {
    activity: { type: String, required: true, index: true },
    comments: { type: String, required: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    user_name: { type: String, required: true },
    organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    organization_name: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip_address: { type: String },
    user_agent: { type: String }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'activity_logs'
  }
);

ActivityLogSchema.index({ created_at: -1 });

ActivityLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
ActivityLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
