'use strict';

const DEFAULT_MAX_AGE_MS = 90_000;

function createHeartbeatHealth({ now = () => Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  let lastSuccessAt = null;

  return {
    markSuccess() {
      lastSuccessAt = now();
    },
    snapshot() {
      const ageMs = lastSuccessAt === null ? null : Math.max(0, now() - lastSuccessAt);
      return {
        ok: ageMs !== null && ageMs < maxAgeMs,
        lastSuccessAt: lastSuccessAt === null ? null : new Date(lastSuccessAt).toISOString(),
        ageMs,
      };
    },
  };
}

module.exports = { DEFAULT_MAX_AGE_MS, createHeartbeatHealth };
