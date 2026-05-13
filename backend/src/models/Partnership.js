const mongoose = require('mongoose');

const { Schema } = mongoose;

const PartnershipSchema = new Schema(
  {
    fleet_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    hospital_id: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    duration_months: { type: Number },
    start_date: { type: Date },
    end_date: { type: Date },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'partnerships'
  }
);

PartnershipSchema.index({ fleet_id: 1, hospital_id: 1 }, { unique: true });

PartnershipSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  }
});
PartnershipSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Partnership', PartnershipSchema);
