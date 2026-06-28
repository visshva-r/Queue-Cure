const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const queueService = require('../services/queueService');

const patientAddLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many check-ins. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function createApiRouter(broadcast) {
  const router = express.Router();

  function handleError(res, err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }

  async function mutate(res, action, status = 200) {
    try {
      const result = await action();
      await broadcast();
      if (status === 201) res.status(201).json(result);
      else res.json(result ?? { ok: true });
    } catch (err) {
      handleError(res, err);
    }
  }

  router.get('/queue', async (req, res) => {
    try {
      res.json(await queueService.buildQueueSnapshot());
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post('/patients', patientAddLimiter, (req, res) => {
    mutate(
      res,
      async () => {
        const patient = await queueService.addPatient(req.body.name);
        return {
          id: patient._id.toString(),
          tokenNumber: patient.tokenNumber,
          name: patient.name,
          status: patient.status,
        };
      },
      201
    );
  });

  router.post('/queue/call-next', (req, res) => {
    mutate(res, async () => {
      const patient = await queueService.callNext();
      return {
        id: patient._id.toString(),
        tokenNumber: patient.tokenNumber,
        name: patient.name,
      };
    });
  });

  router.post('/queue/complete', (req, res) => {
    mutate(res, async () => {
      const patient = await queueService.completeCurrent();
      return {
        id: patient._id.toString(),
        tokenNumber: patient.tokenNumber,
        consultationDurationMinutes: patient.consultationDurationMinutes,
      };
    });
  });

  router.post('/queue/no-show', (req, res) => {
    mutate(res, async () => {
      const patient = await queueService.markNoShow();
      return { id: patient._id.toString(), tokenNumber: patient.tokenNumber };
    });
  });

  router.delete('/patients/:id', (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient id' });
    }
    mutate(res, async () => {
      const patient = await queueService.removeFromQueue(req.params.id);
      return {
        id: patient._id.toString(),
        tokenNumber: patient.tokenNumber,
        name: patient.name,
      };
    });
  });

  router.post('/patients/:id/restore', (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient id' });
    }
    mutate(res, async () => {
      const patient = await queueService.restoreToQueue(req.params.id);
      return {
        id: patient._id.toString(),
        tokenNumber: patient.tokenNumber,
        name: patient.name,
      };
    });
  });

  router.patch('/settings/avg-consultation', (req, res) => {
    mutate(res, async () => {
      const settings = await queueService.updateAvgConsultationMinutes(
        req.body.avgConsultationMinutes
      );
      return { avgConsultationMinutes: settings.avgConsultationMinutes };
    });
  });

  router.post('/queue/reset-day', (req, res) => {
    mutate(res, async () => {
      await queueService.resetDayQueue();
      return { ok: true };
    });
  });

  return router;
}

module.exports = createApiRouter;
