'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createKeyedOperationQueue } = require('./session-operation-queue');

test('serializa operações da mesma sessão sem bloquear outras sessões', async () => {
  const run = createKeyedOperationQueue();
  const events = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

  const first = run('session-a', async () => {
    events.push('a1:start');
    await firstGate;
    events.push('a1:end');
  });
  const second = run('session-a', async () => { events.push('a2'); });
  const otherSession = run('session-b', async () => { events.push('b1'); });

  await otherSession;
  assert.deepEqual(events, ['a1:start', 'b1']);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['a1:start', 'b1', 'a1:end', 'a2']);
});

test('continua a fila após uma operação falhar', async () => {
  const run = createKeyedOperationQueue();
  const failed = run('session-a', async () => { throw new Error('falha controlada'); });
  const recovered = run('session-a', async () => 'recuperada');

  await assert.rejects(failed, /falha controlada/);
  assert.equal(await recovered, 'recuperada');
});
