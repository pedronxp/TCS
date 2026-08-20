import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const configPath = fileURLToPath(new URL('../playwright.config.ts', import.meta.url));
const config = await readFile(configPath, 'utf8');

assert.match(config, /fullyParallel:\s*true/, 'Visual snapshots must run in parallel.');
assert.match(
  config,
  /workers:\s*process\.env\.CI\s*\?\s*4\s*:\s*undefined/,
  'CI must allocate four workers to the isolated visual snapshots.',
);

console.log('Visual runner parallelism is configured for CI.');
