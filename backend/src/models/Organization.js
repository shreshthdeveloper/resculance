const mongoose = require('mongoose');

const { Schema } = mongoose;

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    type: {
      type: String,
      enum: ['hospital', 'fleet_owner', 'superadmin'],
      required: true,
      index: true
    },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String, default: 'India' },
    pincode: { type: String },
    contact_person: { type: String },
    contact_email: { type: String },
    contact_phone: { type: String },
    license_number: { type: String },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true
    },
    is_active: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'organizations'
  }
);

OrganizationSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
OrganizationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Organization', OrganizationSchema);
