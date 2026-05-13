const mongoose = require('mongoose');

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expires_at: { type: Date, required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    collection: 'refresh_tokens'
  }
);

// TTL: auto-remove expired tokens
RefreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

RefreshTokenSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
RefreshTokenSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
