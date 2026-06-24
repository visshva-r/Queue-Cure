/**
 * Zero-AI automated smoke test for Queue Cure.
 * Run: node scripts/smoke-test.mjs
 * Requires backend running on http://localhost:3001
 */

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { io } = require(join(dirname(fileURLToPath(import.meta.url)), '../frontend/node_modules/socket.io-client'));

const BASE = process.env.API_URL || 'http://localhost:3001';
let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, err) {
  failed++;
  console.error(`  ✗ ${label}`);
  if (err) console.error(`    ${err.message || err}`);
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function assert(condition, label, detail) {
  if (condition) ok(label);
  else fail(label, new Error(detail || 'assertion failed'));
}

async function testHealth() {
  console.log('\n1. Health check');
  const { res, body } = await api('/health');
  assert(res.status === 200, 'GET /health returns 200');
  assert(body.ok === true, 'health payload ok');
}

async function testAddPatient() {
  console.log('\n2. Add patient');
  const { res, body } = await api('/api/patients', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke Test Patient' }),
  });
  assert(res.status === 201, 'POST /api/patients returns 201');
  assert(body.tokenNumber >= 1, 'token number assigned', `got ${body.tokenNumber}`);
  assert(body.name === 'Smoke Test Patient', 'name saved');
  return body;
}

async function testQueueSnapshot() {
  console.log('\n3. Queue snapshot & wait time');
  const { res, body } = await api('/api/queue');
  assert(res.status === 200, 'GET /api/queue returns 200');
  assert(Array.isArray(body.waiting), 'waiting is array');
  assert(body.settings?.effectiveAvgMinutes > 0, 'effective avg minutes > 0');
  const waiting = body.waiting.find((p) => p.name === 'Smoke Test Patient');
  assert(!!waiting, 'patient appears in queue');
  if (waiting) {
    assert(typeof waiting.estimatedWaitMinutes === 'number', 'wait time is a number');
    assert(waiting.estimatedWaitMinutes >= 0, 'wait time non-negative');
    ok(`wait time = ${waiting.estimatedWaitMinutes} min (from real queue data)`);
  }
  return body;
}

async function testCallNextAndComplete() {
  console.log('\n4. Call next & complete consultation');
  const { res: callRes, body: called } = await api('/api/queue/call-next', { method: 'POST' });
  assert(callRes.status === 200, 'POST /api/queue/call-next returns 200');
  assert(called.tokenNumber >= 1, 'called token returned');

  const { body: during } = await api('/api/queue');
  assert(during.currentToken === called.tokenNumber, 'current token updated');

  const { res: doneRes } = await api('/api/queue/complete', { method: 'POST' });
  assert(doneRes.status === 200, 'POST /api/queue/complete returns 200');

  const { body: after } = await api('/api/queue');
  assert(after.currentToken === null, 'current token cleared after complete');
}

async function testLiveSocket() {
  console.log('\n5. Live socket sync');

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      fail('socket received queue:update within 8s', new Error('timeout'));
      socket.disconnect();
      resolve();
    }, 8000);

    const socket = io(BASE, { transports: ['websocket', 'polling'], reconnection: false });

    socket.on('connect', async () => {
      ok('socket connected');

      socket.once('queue:update', (snapshot) => {
        clearTimeout(timeout);
        assert(snapshot && typeof snapshot.waitingCount === 'number', 'queue:update has waitingCount');
        ok('queue:update received after mutation');
        socket.disconnect();
        resolve();
      });

      try {
        await api('/api/patients', {
          method: 'POST',
          body: JSON.stringify({ name: 'Socket Test Patient' }),
        });
      } catch (e) {
        clearTimeout(timeout);
        fail('trigger mutation for socket test', e);
        socket.disconnect();
        resolve();
      }
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      fail('socket connect', err);
      resolve();
    });
  });
}

async function main() {
  console.log('Queue Cure — automated smoke test (no AI quota used)');
  console.log(`Target: ${BASE}`);

  try {
    await fetch(`${BASE}/health`);
  } catch {
    console.error('\nBackend not running! Start it first:');
    console.error('  cd Project/backend && npm run dev\n');
    process.exit(1);
  }

  await testHealth();
  await testAddPatient();
  await testQueueSnapshot();
  await testCallNextAndComplete();
  await testLiveSocket();

  console.log('\n─────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('─────────────────────────────\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
