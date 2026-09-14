'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHeartbeatHealth } = require('./heartbeat-health');

test('healthcheck permanece indisponível até o primeiro heartbeat confirmado', () => {
  const health = createHeartbeatHealth({ now: () => 1_000, maxAgeMs: 90_000 });
  assert.deepEqual(health.snapshot(), { ok: false, lastSuccessAt: null, ageMs: null });
});

test('healthcheck vence no mesmo limite usado pelo runtime do painel', () => {
  let clock = 1_000;
  const health = createHeartbeatHealth({ now: () => clock, maxAgeMs: 90_000 });
  health.markSuccess();

  assert.deepEqual(health.snapshot(), { ok: true, lastSuccessAt: '1970-01-01T00:00:01.000Z', ageMs: 0 });
  clock += 90_000;
  assert.equal(health.snapshot().ok, false);
});
