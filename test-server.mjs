import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port = 3199;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error('Test server did not start.');
}

try {
  await waitForServer();
  const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);
  assert.equal(health.mode, 'dynamic');

  const data = await fetch(`http://127.0.0.1:${port}/api/data`).then((r) => r.json());
  assert.equal(data.rooms.length, 14);
  assert.equal(data.events.length, 262);

  const search = await fetch(`http://127.0.0.1:${port}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters: { date: '2026-09-28', time: '09:50', duration: 60, floor: 'all', ac: 'any', people: '' } })
  }).then((r) => r.json());
  assert.equal(search.summary.trackedVenues, 14);
  assert.ok(Array.isArray(search.results));

  const textSearch = await fetch(`http://127.0.0.1:${port}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Any room tomorrow at 11 am for 1 hour', base: { date: '2026-09-28', time: '10:00', duration: 60, floor: 'all', ac: 'any', people: '' } })
  }).then((r) => r.json());
  assert.equal(textSearch.filters.time, '11:00');

  console.log('Passed: dynamic API health, bootstrap data, filter search, and text search.');
} finally {
  child.kill('SIGTERM');
}
