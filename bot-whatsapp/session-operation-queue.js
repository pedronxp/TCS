'use strict';

function createKeyedOperationQueue() {
  const tails = new Map();

  return async function run(key, operation) {
    const previous = tails.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.catch(() => undefined).then(() => gate);
    tails.set(key, tail);

    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (tails.get(key) === tail) tails.delete(key);
    }
  };
}

module.exports = { createKeyedOperationQueue };
