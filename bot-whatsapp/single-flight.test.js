'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSingleFlight } = require('./single-flight');

test('não sobrepõe execuções lentas do mesmo ciclo', async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const run = createSingleFlight(async () => { calls += 1; await gate; });
  const first = run();
  const second = run();
  assert.equal(first, second);
  release();
  await first;
  await run();
  assert.equal(calls, 2);
});
