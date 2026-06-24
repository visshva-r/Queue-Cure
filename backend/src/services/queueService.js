const { ClinicSettings, Patient, ConsultationRecord } = require('../models');

const CLINIC_ID = 'default';
const ROLLING_WINDOW = 20;

async function getOrCreateSettings() {
  let settings = await ClinicSettings.findOne({ clinicId: CLINIC_ID });
  if (!settings) {
    settings = await ClinicSettings.create({ clinicId: CLINIC_ID });
  }
  return settings;
}

async function getRollingAverageMinutes() {
  const records = await ConsultationRecord.find({ clinicId: CLINIC_ID })
    .sort({ recordedAt: -1 })
    .limit(ROLLING_WINDOW)
    .lean();

  if (records.length === 0) return null;

  const total = records.reduce((sum, r) => sum + r.durationMinutes, 0);
  return Math.round((total / records.length) * 10) / 10;
}

async function getEffectiveAvgMinutes(settings) {
  const rolling = await getRollingAverageMinutes();
  if (rolling !== null) return rolling;
  return settings.avgConsultationMinutes;
}

function minutesBetween(start, end) {
  return Math.max(0.5, Math.round(((end - start) / 60000) * 10) / 10);
}

async function buildQueueSnapshot() {
  const settings = await getOrCreateSettings();

  const [waiting, inConsultation, completedToday] = await Promise.all([
    Patient.find({ clinicId: CLINIC_ID, status: 'waiting' }).sort({ tokenNumber: 1 }).lean(),
    Patient.findOne({ clinicId: CLINIC_ID, status: 'in_consultation' }).lean(),
    Patient.countDocuments({
      clinicId: CLINIC_ID,
      status: 'completed',
      completedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
  ]);

  const avgMinutes = await getEffectiveAvgMinutes(settings);
  const rollingSampleSize = await ConsultationRecord.countDocuments({ clinicId: CLINIC_ID });
  const rollingCount = Math.min(rollingSampleSize, ROLLING_WINDOW);

  const currentToken = inConsultation?.tokenNumber ?? null;
  const currentPatientName = inConsultation?.name ?? null;

  let elapsedInCurrent = 0;
  if (inConsultation?.calledAt) {
    elapsedInCurrent = minutesBetween(new Date(inConsultation.calledAt), new Date());
  }

  const waitingWithEstimates = waiting.map((p, index) => {
    const patientsAhead = index + (inConsultation ? 1 : 0);
    const estimatedWaitMinutes = Math.round(patientsAhead * avgMinutes * 10) / 10;
    return {
      id: p._id.toString(),
      tokenNumber: p.tokenNumber,
      name: p.name,
      joinedAt: p.joinedAt,
      position: index + 1,
      patientsAhead,
      estimatedWaitMinutes,
    };
  });

  return {
    clinicId: CLINIC_ID,
    currentToken,
    currentPatientName,
    elapsedInCurrentMinutes: elapsedInCurrent,
    waiting: waitingWithEstimates,
    waitingCount: waiting.length,
    completedToday,
    settings: {
      avgConsultationMinutes: settings.avgConsultationMinutes,
      effectiveAvgMinutes: avgMinutes,
      avgSource: rollingCount > 0 ? 'rolling_average' : 'receptionist_setting',
      rollingSampleSize: rollingCount,
      nextTokenNumber: settings.nextTokenNumber,
    },
    serverTime: new Date().toISOString(),
  };
}

async function addPatient(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw Object.assign(new Error('Patient name is required'), { status: 400 });
  }

  const settings = await getOrCreateSettings();

  const patient = await Patient.create({
    clinicId: CLINIC_ID,
    tokenNumber: settings.nextTokenNumber,
    name: trimmed,
    status: 'waiting',
  });

  settings.nextTokenNumber += 1;
  await settings.save();

  return patient;
}

async function callNext() {
  const inConsultation = await Patient.findOne({
    clinicId: CLINIC_ID,
    status: 'in_consultation',
  });

  if (inConsultation) {
    throw Object.assign(new Error('Finish current consultation before calling next'), {
      status: 409,
    });
  }

  const next = await Patient.findOneAndUpdate(
    { clinicId: CLINIC_ID, status: 'waiting' },
    { $set: { status: 'in_consultation', calledAt: new Date() } },
    { sort: { tokenNumber: 1 }, new: true }
  );

  if (!next) {
    throw Object.assign(new Error('No patients waiting in queue'), { status: 404 });
  }

  return next;
}

async function completeCurrent() {
  const current = await Patient.findOne({
    clinicId: CLINIC_ID,
    status: 'in_consultation',
  });

  if (!current) {
    throw Object.assign(new Error('No patient currently in consultation'), { status: 404 });
  }

  const completedAt = new Date();
  const durationMinutes = current.calledAt
    ? minutesBetween(new Date(current.calledAt), completedAt)
    : null;

  current.status = 'completed';
  current.completedAt = completedAt;
  current.consultationDurationMinutes = durationMinutes;
  await current.save();

  if (durationMinutes) {
    await ConsultationRecord.create({
      clinicId: CLINIC_ID,
      tokenNumber: current.tokenNumber,
      durationMinutes,
    });
  }

  return current;
}

async function markNoShow() {
  const current = await Patient.findOne({
    clinicId: CLINIC_ID,
    status: 'in_consultation',
  });

  if (!current) {
    throw Object.assign(new Error('No patient currently in consultation'), { status: 404 });
  }

  current.status = 'no_show';
  current.completedAt = new Date();
  await current.save();
  return current;
}

async function removeFromQueue(patientId) {
  const patient = await Patient.findOne({
    _id: patientId,
    clinicId: CLINIC_ID,
    status: 'waiting',
  });

  if (!patient) {
    throw Object.assign(new Error('Patient not found in waiting queue'), { status: 404 });
  }

  patient.status = 'no_show';
  patient.completedAt = new Date();
  await patient.save();
  return patient;
}

async function updateAvgConsultationMinutes(minutes) {
  const parsed = Number(minutes);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 120) {
    throw Object.assign(new Error('Average must be between 1 and 120 minutes'), { status: 400 });
  }

  const settings = await getOrCreateSettings();
  settings.avgConsultationMinutes = Math.round(parsed);
  await settings.save();
  return settings;
}

async function resetDayQueue() {
  await Patient.updateMany(
    { clinicId: CLINIC_ID, status: { $in: ['waiting', 'in_consultation'] } },
    { $set: { status: 'no_show', completedAt: new Date() } }
  );

  const settings = await getOrCreateSettings();
  settings.nextTokenNumber = 1;
  settings.lastResetAt = new Date();
  await settings.save();
  return settings;
}

module.exports = {
  buildQueueSnapshot,
  addPatient,
  callNext,
  completeCurrent,
  markNoShow,
  removeFromQueue,
  updateAvgConsultationMinutes,
  resetDayQueue,
};
