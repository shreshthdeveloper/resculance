const mongoose = require('mongoose');

const { Schema } = mongoose;

const CommunicationSchema = new Schema(
  {
    session_id: { type: Schema.Types.ObjectId, ref: 'PatientSession', required: true, index: true },
    sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message_type: {
      type: String,
      enum: ['text', 'voice', 'video', 'alert', 'vital_update', 'location_update'],
      default: 'text'
    },
    message: { type: String },
    metadata: { type: Schema.Types.Mixed },
    read_by: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'communications'
  }
);

CommunicationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
CommunicationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Communication', CommunicationSchema);
