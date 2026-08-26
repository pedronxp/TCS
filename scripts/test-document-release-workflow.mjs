import assert from 'node:assert/strict';
import test from 'node:test';

import {
  documentReleaseMessage,
  resolveDocumentRelease,
} from '../services/DocumentReleaseWorkflow.ts';

test('encaminha para ciência antes de liberar uma versão preparada', () => {
  assert.equal(resolveDocumentRelease({ documentId: 'document-1', enabled: true, errorMessage: null }), 'collect_acknowledgement');
});

test('permite compartilhamento direto somente quando a ciência está desabilitada', () => {
  assert.equal(resolveDocumentRelease({ documentId: null, enabled: false, errorMessage: null }), 'share');
});

test('bloqueia a liberação quando a ciência está habilitada e a versão falha', () => {
  const preparation = { documentId: null, enabled: true, errorMessage: 'storage_failed' };
  assert.equal(resolveDocumentRelease(preparation), 'blocked');
  assert.deepEqual(documentReleaseMessage(preparation, 'Laudo'), {
    title: 'Laudo não liberado',
    message: 'A versão usada na ciência não foi preservada. Tente gerar novamente antes de compartilhar.',
  });
});
