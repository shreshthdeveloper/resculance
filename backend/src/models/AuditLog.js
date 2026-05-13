const mongoose = require('mongoose');

const { Schema } = mongoose;

const AuditLogSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity_type: { type: String, index: true },
    entity_id: { type: Schema.Types.ObjectId },
    old_values: { type: Schema.Types.Mixed },
    new_values: { type: Schema.Types.Mixed },
    ip_address: { type: String },
    user_agent: { type: String }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'audit_logs'
  }
);

AuditLogSchema.index({ entity_type: 1, entity_id: 1 });
AuditLogSchema.index({ created_at: -1 });

AuditLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
AuditLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
