const mongoose = require('mongoose');

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    is_read: { type: Boolean, default: false },
    read_at: { type: Date }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'notifications'
  }
);

NotificationSchema.index({ user_id: 1, is_read: 1 });
NotificationSchema.index({ created_at: -1 });

NotificationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
NotificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', NotificationSchema);
