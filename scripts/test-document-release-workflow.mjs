import assert from 'node:assert/strict';
import test from 'node:test';

import * as workflow from '../services/DocumentReleaseWorkflow.ts';

const { documentReleaseMessage, resolveDocumentRelease } = workflow;

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

test('libera documento e comprovante somente após confirmação e protocolo do servidor', () => {
  assert.equal(typeof workflow.canReleaseAcknowledgementEvidence, 'function');
  const canReleaseAcknowledgementEvidence = workflow.canReleaseAcknowledgementEvidence;
  assert.equal(canReleaseAcknowledgementEvidence({ syncStatus: 'pending', protocol: null }), false);
  assert.equal(canReleaseAcknowledgementEvidence({ syncStatus: 'failed', protocol: null }), false);
  assert.equal(canReleaseAcknowledgementEvidence({ syncStatus: 'confirmed', protocol: null }), false);
  assert.equal(canReleaseAcknowledgementEvidence({ syncStatus: 'confirmed', protocol: 'TCS-CIE-1' }), true);
});

test('publica todas as versões preparadas para ficarem disponíveis no portal', async () => {
  assert.equal(typeof workflow.syncPreparedDocumentBatch, 'function');
  const syncPreparedDocumentBatch = workflow.syncPreparedDocumentBatch;
  const published = [];
  const result = await syncPreparedDocumentBatch(
    [{ id: 'doc-1' }, { id: 'doc-2' }],
    async (document) => { published.push(document.id); },
  );

  assert.deepEqual(published, ['doc-1', 'doc-2']);
  assert.deepEqual(result, { success: 2, failed: 0 });
});

test('mantém versão preparada na fila quando a publicação falha', async () => {
  assert.equal(typeof workflow.syncPreparedDocumentBatch, 'function');
  const syncPreparedDocumentBatch = workflow.syncPreparedDocumentBatch;
  const result = await syncPreparedDocumentBatch(
    [{ id: 'doc-ok' }, { id: 'doc-fail' }],
    async (document) => {
      if (document.id === 'doc-fail') throw new Error('network_error');
    },
  );

  assert.deepEqual(result, { success: 1, failed: 1 });
});

test('reconhece somente conflito terminal de resultado já finalizado', () => {
  assert.equal(typeof workflow.isFinalOutcomeConflict, 'function');
  assert.equal(workflow.isFinalOutcomeConflict({ code: '23505', message: 'document_already_acknowledged' }), true);
  assert.equal(workflow.isFinalOutcomeConflict({ code: '23505', message: 'duplicate key document_acknowledgement_events_one_outcome_idx' }), true);
  assert.equal(workflow.isFinalOutcomeConflict({ code: '23505', message: 'document_identity_conflict' }), false);
  assert.equal(workflow.isFinalOutcomeConflict({ code: '42501', message: 'document_scope_denied' }), false);
});
