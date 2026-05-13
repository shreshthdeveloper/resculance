const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    organization_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: [
        'superadmin',
        'hospital_admin', 'hospital_staff', 'hospital_doctor', 'hospital_paramedic',
        'fleet_admin', 'fleet_staff', 'fleet_doctor', 'fleet_paramedic', 'fleet_driver'
      ],
      required: true,
      index: true
    },
    first_name: { type: String, required: true },
    // last_name is NOT NULL in the legacy MySQL schema, but in practice many rows
    // store an empty string. Treat it as optional here so migration & API both work
    // with users that have only a first name.
    last_name: { type: String, default: '' },
    phone: { type: String },
    status: {
      type: String,
      enum: ['pending_approval', 'active', 'inactive', 'suspended'],
      default: 'pending_approval',
      index: true
    },
    last_login: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    profile_image_url: { type: String }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users'
  }
);

UserSchema.pre('save', async function preHashPassword(next) {
  if (!this.isModified('password')) return next();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

UserSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

UserSchema.statics.hashPassword = function hashPassword(plain) {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  return bcrypt.hash(plain, rounds);
};

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password;
    return ret;
  }
});
UserSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', UserSchema);
