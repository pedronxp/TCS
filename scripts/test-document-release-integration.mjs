import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screens = [
  'app/(panel)/inspecoes/resultado.tsx',
  'app/(panel)/inspecoes/laudo.tsx',
  'app/(panel)/inspecoes/relatorio.tsx',
];

test('all document screens use the guarded release workflow', async () => {
  for (const path of screens) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /resolveDocumentRelease/);
    assert.match(source, /liberarDocumento/);
    assert.doesNotMatch(source, /concluirOfertaCiencia/);
  }
});

test('editable report freezes the edited snapshot before release', async () => {
  const source = await readFile(new URL('../app/(panel)/inspecoes/relatorio.tsx', import.meta.url), 'utf8');

  assert.match(source, /prepareGeneratedDocument/);
  assert.match(source, /condutaRecomendada: draft\.condutaRecomendada/);
  assert.match(source, /observacoesTecnicas: draft\.observacoesTecnicas/);
  assert.match(source, /cargo: draft\.cargo/);
  const preparationIndex = source.indexOf("prepararCiencia('report'");
  const releaseIndex = source.indexOf('await liberarDocumento(acknowledgementDocument', preparationIndex);
  assert.ok(
    preparationIndex >= 0 && releaseIndex > preparationIndex,
    'the editable report must be prepared before it is released',
  );
});

test('prepared versions are synchronized before pending acknowledgement events', async () => {
  const source = await readFile(new URL('../services/SyncService.ts', import.meta.url), 'utf8');
  const preparedIndex = source.indexOf('syncPreparedGeneratedDocuments()');
  const acknowledgementIndex = source.indexOf('syncPendingDocumentAcknowledgements()');

  assert.ok(preparedIndex >= 0, 'prepared document sync must be part of the regular queue');
  assert.ok(
    acknowledgementIndex > preparedIndex,
    'prepared documents must be published before their acknowledgement events',
  );
});

test('each generation screen requests publication of the prepared version', async () => {
  for (const path of screens) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /syncPendentes\(\)/, `${path} must request document publication`);
  }
});
