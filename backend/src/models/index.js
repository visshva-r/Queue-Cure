const mongoose = require('mongoose');

const clinicSettingsSchema = new mongoose.Schema(
  {
    clinicId: { type: String, default: 'default', unique: true },
    avgConsultationMinutes: { type: Number, default: 12, min: 1, max: 120 },
    nextTokenNumber: { type: Number, default: 1 },
    lastResetAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const patientSchema = new mongoose.Schema(
  {
    clinicId: { type: String, default: 'default', index: true },
    tokenNumber: { type: Number, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: ['waiting', 'in_consultation', 'completed', 'no_show'],
      default: 'waiting',
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
    calledAt: { type: Date },
    completedAt: { type: Date },
    consultationDurationMinutes: { type: Number },
  },
  { timestamps: true }
);

patientSchema.index({ clinicId: 1, tokenNumber: 1 }, { unique: true });
patientSchema.index({ clinicId: 1, status: 1, tokenNumber: 1 });

const consultationRecordSchema = new mongoose.Schema(
  {
    clinicId: { type: String, default: 'default', index: true },
    tokenNumber: { type: Number, required: true },
    durationMinutes: { type: Number, required: true, min: 0 },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const ClinicSettings = mongoose.model('ClinicSettings', clinicSettingsSchema);
const Patient = mongoose.model('Patient', patientSchema);
const ConsultationRecord = mongoose.model('ConsultationRecord', consultationRecordSchema);

module.exports = { ClinicSettings, Patient, ConsultationRecord };
