'use strict';

function createSingleFlight(task) {
  let active = null;
  return () => {
    if (active) return active;
    active = Promise.resolve().then(task).finally(() => { active = null; });
    return active;
  };
}

module.exports = { createSingleFlight };
