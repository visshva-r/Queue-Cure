const { Server } = require('socket.io');
const queueService = require('../services/queueService');

function setupSocket(io) {
  io.on('connection', async (socket) => {
    socket.join('clinic:default');

    try {
      const snapshot = await queueService.buildQueueSnapshot();
      socket.emit('queue:sync', snapshot);
    } catch (err) {
      socket.emit('queue:error', { message: 'Failed to load queue state' });
    }

    socket.on('disconnect', () => {});
  });
}

async function broadcastQueueUpdate(io) {
  const snapshot = await queueService.buildQueueSnapshot();
  io.to('clinic:default').emit('queue:update', snapshot);
  return snapshot;
}

module.exports = { setupSocket, broadcastQueueUpdate };
