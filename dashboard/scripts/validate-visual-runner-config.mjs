import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const configPath = fileURLToPath(new URL('../playwright.config.ts', import.meta.url));
const config = await readFile(configPath, 'utf8');

assert.match(config, /fullyParallel:\s*false/, 'Visual snapshots must run serially.');
assert.match(config, /workers:\s*1/, 'CI must use one worker for deterministic snapshots.');

console.log('Visual runner serial execution is configured for CI.');
