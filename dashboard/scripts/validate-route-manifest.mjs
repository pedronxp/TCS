import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { routeManifest, routeTemplates } from '../design/route-manifest.mjs';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const privateSource = await readFile(new URL('../src/PrivateApp.tsx', import.meta.url), 'utf8');
const manifestPaths = new Set(routeManifest.map((entry) => entry.path));
const ids = new Set();

for (const entry of routeManifest) {
  assert(entry.id && !ids.has(entry.id), `ID ausente ou duplicado no manifesto: ${entry.id}`);
  ids.add(entry.id);
  assert(entry.path.startsWith('/'), `Rota deve ser absoluta: ${entry.id}`);
  assert(routeTemplates.includes(entry.template), `Template desconhecido em ${entry.id}: ${entry.template}`);
  assert(Array.isArray(entry.audience) && entry.audience.length > 0, `Audiência ausente em ${entry.id}`);
  assert(typeof entry.penpot === 'string' && entry.penpot.length > 0, `Referência Penpot ausente em ${entry.id}`);
  assert(Array.isArray(entry.states) && entry.states.length > 0, `Estados ausentes em ${entry.id}`);
  assert.deepEqual(entry.breakpoints, [1440, 1024, 768, 390], `Breakpoints incompletos em ${entry.id}`);
  assert(typeof entry.approvalStatus === 'string', `Aprovação visual ausente em ${entry.id}`);
  assert(
    typeof entry.automatedVisualBaselines === 'string',
    `Regressão visual automatizada ausente em ${entry.id}`,
  );
  for (const breakpoint of entry.breakpoints) {
    const baseline = entry.automatedVisualBaselines.replace('{1440,1024,768,390}', String(breakpoint));
    await access(new URL(`../${baseline}`, import.meta.url)).catch(() => {
      assert.fail(`Baseline visual ausente em ${entry.id} (${breakpoint}px): ${baseline}`);
    });
  }
}

function declaredPaths(source, appChildren = false) {
  return [...source.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => path !== '*' && path !== '/*')
    .map((path) => path.startsWith('/') || !appChildren ? path : `/app/${path}`);
}

const declared = new Set([
  '/',
  ...declaredPaths(appSource),
  ...declaredPaths(privateSource, true),
]);

const missingFromManifest = [...declared].filter((path) => !manifestPaths.has(path));
const missingFromRouter = [...manifestPaths].filter((path) => !declared.has(path));
assert.deepEqual(missingFromManifest, [], `Rotas sem manifesto: ${missingFromManifest.join(', ')}`);
assert.deepEqual(missingFromRouter, [], `Entradas sem rota correspondente: ${missingFromRouter.join(', ')}`);
assert(manifestPaths.has('/app/referencia-ui'), 'A referência de UI deve estar coberta pelo manifesto.');

console.log(`Manifesto de rotas validado: ${routeManifest.length} entradas, ${declared.size} caminhos.`);
