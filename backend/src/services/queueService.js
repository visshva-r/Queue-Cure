const { ClinicSettings, Patient, ConsultationRecord } = require('../models');

const CLINIC_ID = 'default';
const ROLLING_WINDOW = 20;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getOrCreateSettings() {
  let settings = await ClinicSettings.findOne({ clinicId: CLINIC_ID });
  if (!settings) {
    settings = await ClinicSettings.create({ clinicId: CLINIC_ID });
  }
  return settings;
}

async function syncTokenCounter() {
  const settings = await getOrCreateSettings();
  const latestToday = await Patient.findOne({
    clinicId: CLINIC_ID,
    joinedAt: { $gte: startOfToday() },
  })
    .sort({ tokenNumber: -1 })
    .select('tokenNumber')
    .lean();

  if (latestToday && latestToday.tokenNumber >= settings.nextTokenNumber) {
    settings.nextTokenNumber = latestToday.tokenNumber + 1;
    await settings.save();
    console.log(`Token counter synced to #${settings.nextTokenNumber}`);
  }
}

async function getRollingAverageMinutes() {
  const records = await ConsultationRecord.find({ clinicId: CLINIC_ID })
    .sort({ recordedAt: -1 })
    .limit(ROLLING_WINDOW)
    .lean();

  if (records.length === 0) return { avg: null, sampleSize: 0 };

  const total = records.reduce((sum, r) => sum + r.durationMinutes, 0);
  return {
    avg: Math.round((total / records.length) * 10) / 10,
    sampleSize: records.length,
  };
}

async function getEffectiveAvgMinutes(settings) {
  const rolling = await getRollingAverageMinutes();
  if (rolling.avg !== null) return rolling;
  return { avg: settings.avgConsultationMinutes, sampleSize: 0 };
}

function minutesBetween(start, end) {
  return Math.round(((end - start) / 60000) * 10) / 10;
}

async function buildQueueSnapshot() {
  const settings = await getOrCreateSettings();
  const now = Date.now();

  const [waiting, inConsultation, completedToday] = await Promise.all([
    Patient.find({ clinicId: CLINIC_ID, status: 'waiting' }).sort({ tokenNumber: 1 }).lean(),
    Patient.findOne({ clinicId: CLINIC_ID, status: 'in_consultation' }).lean(),
    Patient.countDocuments({
      clinicId: CLINIC_ID,
      status: 'completed',
      completedAt: { $gte: startOfToday() },
    }),
  ]);

  const { avg: avgMinutes, sampleSize: rollingCount } = await getEffectiveAvgMinutes(settings);

  const currentToken = inConsultation?.tokenNumber ?? null;
  const currentPatientName = inConsultation?.name ?? null;
  const currentCalledAt = inConsultation?.calledAt?.toISOString?.() ?? inConsultation?.calledAt ?? null;

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
      estimatedCallAt: new Date(now + estimatedWaitMinutes * 60000).toISOString(),
    };
  });

  return {
    clinicId: CLINIC_ID,
    currentToken,
    currentPatientName,
    currentCalledAt,
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

  const settings = await ClinicSettings.findOneAndUpdate(
    { clinicId: CLINIC_ID },
    { $inc: { nextTokenNumber: 1 } },
    { new: false, upsert: true }
  );

  const tokenNumber = settings?.nextTokenNumber ?? 1;

  const patient = await Patient.create({
    clinicId: CLINIC_ID,
    tokenNumber,
    name: trimmed,
    status: 'waiting',
  });

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

  if (durationMinutes !== null) {
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

  patient.status = 'cancelled';
  patient.completedAt = new Date();
  await patient.save();
  return patient;
}

async function restoreToQueue(patientId) {
  const patient = await Patient.findOne({
    _id: patientId,
    clinicId: CLINIC_ID,
    status: 'cancelled',
  });

  if (!patient) {
    throw Object.assign(new Error('Patient cannot be restored'), { status: 404 });
  }

  patient.status = 'waiting';
  patient.completedAt = undefined;
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
    { clinicId: CLINIC_ID, status: 'waiting' },
    { $set: { status: 'cancelled', completedAt: new Date() } }
  );
  await Patient.updateMany(
    { clinicId: CLINIC_ID, status: 'in_consultation' },
    { $set: { status: 'no_show', completedAt: new Date() } }
  );

  // ConsultationRecord is intentionally NOT cleared on reset.
  // Historical durations persist across days to maintain rolling average accuracy.

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
  restoreToQueue,
  updateAvgConsultationMinutes,
  resetDayQueue,
  syncTokenCounter,
};
