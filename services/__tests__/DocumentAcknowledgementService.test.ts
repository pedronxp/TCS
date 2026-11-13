jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    exists = true;
    constructor(...parts: Array<string | { uri?: string }>) {
      this.uri = parts
        .map(part => typeof part === 'string' ? part : part.uri || '')
        .filter(Boolean)
        .join('/');
    }
    delete() {}
    copy() {}
  },
  Directory: class {
    uri: string;
    exists = true;
    constructor(...parts: Array<string | { uri?: string }>) {
      this.uri = parts
        .map(part => typeof part === 'string' ? part : part.uri || '')
        .filter(Boolean)
        .join('/');
    }
    create() {}
  },
  Paths: { document: 'file:///documents' },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 100 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('device-id'),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/documentIntegrity', () => ({
  canonicalize: (value: unknown) => JSON.stringify(value),
  createDocumentSnapshot: (documentType: string, templateVersion: string, vistoriaId: string, trainingMode: boolean, payload: object) =>
    ({ documentType, templateVersion, vistoriaId, trainingMode, payload }),
  hasMinimumSignature: (strokes: unknown[]) => strokes.length > 0,
  hashCanonical: jest.fn().mockResolvedValue('a'.repeat(64)),
  normalizeSignatureStrokes: (value: unknown) => value,
  sha256Bytes: jest.fn().mockResolvedValue('b'.repeat(64)),
  sha256File: jest.fn().mockResolvedValue({ hash: 'b'.repeat(64), byteSize: 100 }),
  sha256String: jest.fn().mockResolvedValue('c'.repeat(64)),
}));

jest.mock('../../utils/documentAcknowledgementDatabase', () => ({
  clearGeneratedDocumentLocalFile: jest.fn(),
  findReusableGeneratedDocument: jest.fn(),
  getGeneratedDocument: jest.fn(),
  getAcknowledgementEvent: jest.fn(),
  refreshRemoteDocumentPreview: jest.fn(),
  reconcileRemoteDocumentAvailability: jest.fn(),
  getNextDocumentVersion: jest.fn().mockReturnValue({ version: 1, supersedesId: null }),
  listPendingAcknowledgementEvents: jest.fn(),
  listPendingGeneratedDocuments: jest.fn(),
  markAcknowledgementConfirmed: jest.fn(),
  markAcknowledgementFailed: jest.fn(),
  markAcknowledgementSuperseded: jest.fn(),
  markAcknowledgementSignatureUploaded: jest.fn(),
  markAcknowledgementSyncing: jest.fn(),
  saveAcknowledgementEvent: jest.fn(),
  saveGeneratedDocument: jest.fn(),
  updateGeneratedDocumentRemote: jest.fn(),
}));

jest.mock('../StorageService', () => ({
  encodeDocumentEvidencePath: (path: string) => `document-evidence:${path}`,
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.test/document.pdf'),
  uploadDocumentEvidenceFile: jest.fn().mockResolvedValue('user/vistoria/document/document.pdf'),
  uploadDocumentSignatureEvidence: jest.fn().mockResolvedValue('user/vistoria/document/signature.json'),
}));

const mockRpc = jest.fn();
jest.mock('../../utils/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'owner' } } }, error: null })) },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({ logger: { warn: jest.fn() } }));

import {
  createAcknowledgementEvent,
  prepareGeneratedDocument,
  syncPendingDocumentAcknowledgements,
  syncPreparedGeneratedDocuments,
  verifyDocumentIntegrity,
  loadRemoteInspectionDocuments,
} from '../DocumentAcknowledgementService';
import { INITIAL_ACKNOWLEDGEMENT_DECLARATION, LocalAcknowledgementEvent, LocalGeneratedDocument } from '../../types/documentAcknowledgement';

const databaseMock = require('../../utils/documentAcknowledgementDatabase');
const storageMock = require('../StorageService');

const document: LocalGeneratedDocument = {
  id: '30000000-0000-4000-8000-000000000001',
  vistoriaId: '40000000-0000-4000-8000-000000000001',
  documentType: 'report',
  documentVersion: 1,
  templateVersion: 'report-v1',
  contentSnapshot: JSON.stringify({ documentType: 'report', payload: {} }),
  contentHash: 'a'.repeat(64),
  pdfHash: 'b'.repeat(64),
  pdfLocalUri: 'file:///documents/document.pdf',
  previewHtml: '<html><body>Documento</body></html>',
  remotePath: null,
  byteSize: 100,
  createdBy: '10000000-0000-4000-8000-000000000001',
  createdAtDevice: '2026-07-17T10:00:00.000Z',
  trainingMode: false,
  status: 'pending_upload',
  supersedesId: null,
};

const pendingEvent: LocalAcknowledgementEvent = {
  id: '50000000-0000-4000-8000-000000000001',
  clientEventId: '60000000-0000-4000-8000-000000000001',
  documentId: document.id,
  outcome: 'acknowledged',
  declarationVersion: 'v1',
  declarationText: INITIAL_ACKNOWLEDGEMENT_DECLARATION.text,
  declarationHash: 'a'.repeat(64),
  recipientName: 'Pessoa Teste',
  recipientRelationship: 'Morador',
  signatureStrokes: [{ points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }] }],
  signatureHash: 'a'.repeat(64),
  reason: null,
  witness: null,
  occurredAtDevice: '2026-07-17T10:01:00.000Z',
  recordedAtServer: null,
  deviceIdHash: 'c'.repeat(64),
  createdBy: document.createdBy,
  syncStatus: 'pending',
  protocol: null,
  remoteSignaturePath: null,
  errorCode: null,
  attempts: 0,
  trainingMode: false,
  correctionOf: null,
  correctionReason: null,
};

describe('DocumentAcknowledgementService', () => {
  it('hydrates another author immutable document without reassigning identity or regenerating it', async () => {
    const { supabase } = require('../../utils/supabase');
    const remote = { id: 'remote-document', vistoria_id: 'inspection-remote', document_type: 'report', document_version: 2,
      template_version: 'v1', content_snapshot: { payload: { agenteNome: 'Pedro' } }, content_hash: 'a'.repeat(64), pdf_hash: 'b'.repeat(64),
      storage_path: 'pedro/inspection/remote/document.pdf', byte_size: 100, created_by: 'pedro', created_at_device: '2026-11-11', status: 'available', training_mode: false };
    supabase.from.mockImplementation((table: string) => table === 'generated_documents'
      ? { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: [remote], error: null }) }) }) }) }) }
      : { select: () => ({ in: () => ({ eq: async () => ({ data: [{ id: 'confirmed-event', client_event_id: 'event', document_id: 'remote-document', outcome: 'acknowledged', created_by: 'owner', recorded_at_server: '2026-11-11', protocol: 'science-1' }], error: null }) }) }) });
    databaseMock.getGeneratedDocument.mockReturnValue(null);
    const [loaded, parallel] = await Promise.all([
      loadRemoteInspectionDocuments('inspection-remote'),
      loadRemoteInspectionDocuments('inspection-remote'),
    ]);
    expect(parallel).toEqual(loaded);
    expect(loaded[0]).toMatchObject({ id: 'remote-document', createdBy: 'pedro', documentVersion: 2, status: 'available', remotePath: remote.storage_path, pdfLocalUri: null });
    expect(loaded[0].previewHtml).toContain('https://signed.example.test/document.pdf');
    expect(databaseMock.saveGeneratedDocument).toHaveBeenCalledWith(loaded[0]);
    expect(databaseMock.saveGeneratedDocument).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(databaseMock.saveAcknowledgementEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'confirmed-event', syncStatus: 'confirmed', createdBy: 'owner' }));
  });
  beforeEach(() => {
    jest.clearAllMocks();
    databaseMock.getGeneratedDocument.mockReturnValue(document);
    databaseMock.findReusableGeneratedDocument.mockReturnValue(null);
    databaseMock.getNextDocumentVersion.mockReturnValue({ version: 1, supersedesId: null });
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([]);
    databaseMock.listPendingGeneratedDocuments.mockReturnValue([]);
  });

  it('cria nova versão vinculada à versão anterior sem substituir seu pacote local', async () => {
    databaseMock.getNextDocumentVersion.mockReturnValue({ version: 2, supersedesId: document.id });

    const next = await prepareGeneratedDocument({
      vistoriaId: document.vistoriaId,
      documentType: 'report',
      templateVersion: 'report-v2',
      payload: { risk: 'high', score: 8 },
      pdfUri: 'file:///source/report-v2.pdf',
      previewHtml: '<html><body>Versão 2</body></html>',
      createdBy: document.createdBy,
    });

    expect(next.documentVersion).toBe(2);
    expect(next.supersedesId).toBe(document.id);
    expect(next.contentSnapshot).toContain('report-v2');
    expect(databaseMock.saveGeneratedDocument).toHaveBeenCalledWith(next);
  });

  it('reutiliza a versão ativa quando o conteúdo não mudou', async () => {
    databaseMock.findReusableGeneratedDocument.mockReturnValue(document);

    const reused = await prepareGeneratedDocument({
      vistoriaId: document.vistoriaId,
      documentType: 'report',
      templateVersion: 'report-v1',
      payload: {},
      pdfUri: 'file:///source/repeated.pdf',
      previewHtml: '<html><body>Documento</body></html>',
      createdBy: document.createdBy,
    });

    expect(reused).toBe(document);
    expect(databaseMock.saveGeneratedDocument).not.toHaveBeenCalled();
    expect(databaseMock.getNextDocumentVersion).not.toHaveBeenCalled();
  });

  it('does not release a final local PDF before authoritative registration succeeds', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('media_revision_conflict') });
    await expect(prepareGeneratedDocument({
      vistoriaId: document.vistoriaId, documentType: 'report', templateVersion: 'report-v3',
      payload: { documentStatus: 'final', mediaRevision: 10 }, pdfUri: 'file:///source/final.pdf',
      previewHtml: '<html>Final</html>', createdBy: document.createdBy,
    })).rejects.toThrow('media_revision_conflict');
    expect(databaseMock.saveGeneratedDocument).toHaveBeenCalled();
    expect(databaseMock.updateGeneratedDocumentRemote).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), 'available');
  });

  it('a repeated final preparation still registers a pending preserved package', async () => {
    databaseMock.findReusableGeneratedDocument.mockReturnValue(document);
    mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
    const prepared = await prepareGeneratedDocument({
      vistoriaId: document.vistoriaId, documentType: 'report', templateVersion: 'report-v3',
      payload: { documentStatus: 'final' }, pdfUri: 'file:///source/final.pdf', previewHtml: '<html>Final</html>', createdBy: document.createdBy,
    });
    expect(mockRpc).toHaveBeenCalledWith('register_generated_document', expect.anything());
    expect(prepared.status).toBe('available');
  });

  it('não permite ciência sem confirmação explícita', async () => {
    await expect(createAcknowledgementEvent({
      documentId: document.id,
      outcome: 'acknowledged',
      declaration: INITIAL_ACKNOWLEDGEMENT_DECLARATION,
      declarationAccepted: false,
      recipientName: 'Pessoa Teste',
      recipientRelationship: 'Morador',
      signatureStrokes: pendingEvent.signatureStrokes,
      createdBy: document.createdBy,
    })).rejects.toThrow('declaração');
  });

  it('exige motivo para recusa', async () => {
    await expect(createAcknowledgementEvent({
      documentId: document.id,
      outcome: 'refused',
      declaration: INITIAL_ACKNOWLEDGEMENT_DECLARATION,
      declarationAccepted: false,
      recipientName: 'Pessoa Teste',
      recipientRelationship: 'Morador',
      reason: '',
      createdBy: document.createdBy,
    })).rejects.toThrow('motivo');
  });

  it('exige testemunha quando a política da coleta determina', async () => {
    await expect(createAcknowledgementEvent({
      documentId: document.id,
      outcome: 'unable_to_sign',
      declaration: INITIAL_ACKNOWLEDGEMENT_DECLARATION,
      declarationAccepted: false,
      recipientName: 'Pessoa Teste',
      recipientRelationship: 'Morador',
      reason: 'Impossibilidade física',
      witnessRequired: true,
      createdBy: document.createdBy,
    })).rejects.toThrow('testemunha');
  });

  it('registra impossibilidade com motivo sem exigir assinatura', async () => {
    const event = await createAcknowledgementEvent({
      documentId: document.id,
      outcome: 'unable_to_sign',
      declaration: INITIAL_ACKNOWLEDGEMENT_DECLARATION,
      declarationAccepted: false,
      recipientName: 'Pessoa Teste',
      recipientRelationship: 'Morador',
      reason: 'Impossibilidade física',
      createdBy: document.createdBy,
    });
    expect(event.outcome).toBe('unable_to_sign');
    expect(event.signatureStrokes).toBeNull();
    expect(event.syncStatus).toBe('pending');
  });

  it('mantém demonstração de treinamento fora da fila remota', async () => {
    databaseMock.getGeneratedDocument.mockReturnValue({ ...document, trainingMode: true });
    const event = await createAcknowledgementEvent({
      documentId: document.id,
      outcome: 'refused',
      declaration: INITIAL_ACKNOWLEDGEMENT_DECLARATION,
      declarationAccepted: false,
      recipientName: 'Pessoa Teste',
      recipientRelationship: 'Morador',
      reason: 'Apenas demonstração',
      createdBy: document.createdBy,
      trainingMode: true,
    });
    expect(event.syncStatus).toBe('confirmed');
    expect(event.protocol).toMatch(/^TREINAMENTO-/);
    expect(event.trainingMode).toBe(true);
  });

  it('finaliza a fila com a mesma chave idempotente', async () => {
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([pendingEvent]);
    mockRpc.mockResolvedValue({
      data: {
        event_id: pendingEvent.id,
        protocol: 'TCS-CIE-20260717-50000000',
        recorded_at_server: '2026-07-17T10:02:00.000Z',
        signature_storage_path: 'user/vistoria/document/signature.json',
        idempotent: false,
      },
      error: null,
    });
    await expect(syncPendingDocumentAcknowledgements()).resolves.toEqual({ success: 1, failed: 0 });
    expect(mockRpc).toHaveBeenCalledWith('finalize_document_acknowledgement', expect.objectContaining({
      p_payload: expect.objectContaining({ client_event_id: pendingEvent.clientEventId }),
    }));
    expect(databaseMock.markAcknowledgementConfirmed).toHaveBeenCalledWith(
      pendingEvent.id,
      'TCS-CIE-20260717-50000000',
      '2026-07-17T10:02:00.000Z',
      'user/vistoria/document/signature.json'
    );
    expect(databaseMock.clearGeneratedDocumentLocalFile).toHaveBeenCalledWith(document.id);
  });

  it('publica versão preparada mesmo quando ainda não existe evento de ciência', async () => {
    databaseMock.listPendingGeneratedDocuments.mockReturnValue([document]);
    mockRpc.mockResolvedValue({ data: { document_id: document.id, status: 'available' }, error: null });

    await expect(syncPreparedGeneratedDocuments()).resolves.toEqual({ success: 1, failed: 0 });
    expect(mockRpc).toHaveBeenCalledWith('register_generated_document', expect.objectContaining({
      p_payload: expect.objectContaining({ document_id: document.id }),
    }));
    expect(databaseMock.updateGeneratedDocumentRemote).toHaveBeenLastCalledWith(
      document.id,
      'user/vistoria/document/document.pdf',
      'available',
    );
  });

  it('retoma upload parcial sem reenviar o PDF e conserva a chave do evento', async () => {
    const partialDocument = { ...document, remotePath: 'user/vistoria/document/document.pdf' };
    databaseMock.getGeneratedDocument.mockReturnValue(partialDocument);
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([pendingEvent]);
    mockRpc.mockResolvedValue({
      data: {
        event_id: pendingEvent.id,
        protocol: 'TCS-CIE-20260717-50000000',
        recorded_at_server: '2026-07-17T10:02:00.000Z',
        signature_storage_path: 'user/vistoria/document/signature.json',
        idempotent: true,
      },
      error: null,
    });

    await expect(syncPendingDocumentAcknowledgements()).resolves.toEqual({ success: 1, failed: 0 });
    expect(storageMock.uploadDocumentEvidenceFile).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('finalize_document_acknowledgement', expect.objectContaining({
      p_payload: expect.objectContaining({ client_event_id: pendingEvent.clientEventId }),
    }));
  });

  it('reutiliza a assinatura já enviada quando uma tentativa anterior falhou', async () => {
    const eventWithUploadedSignature = {
      ...pendingEvent,
      remoteSignaturePath: 'user/vistoria/document/signature.json',
    };
    databaseMock.getGeneratedDocument.mockReturnValue({
      ...document,
      remotePath: 'user/vistoria/document/document.pdf',
    });
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([eventWithUploadedSignature]);
    mockRpc.mockResolvedValue({
      data: {
        event_id: pendingEvent.id,
        protocol: 'TCS-CIE-20260717-50000000',
        recorded_at_server: '2026-07-17T10:02:00.000Z',
        signature_storage_path: eventWithUploadedSignature.remoteSignaturePath,
        idempotent: true,
      },
      error: null,
    });

    await expect(syncPendingDocumentAcknowledgements()).resolves.toEqual({ success: 1, failed: 0 });

    expect(storageMock.uploadDocumentSignatureEvidence).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('finalize_document_acknowledgement', expect.objectContaining({
      p_payload: expect.objectContaining({
        signature_storage_path: eventWithUploadedSignature.remoteSignaturePath,
      }),
    }));
  });

  it('informa que a vistoria ainda precisa ser sincronizada antes da ciência', async () => {
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([pendingEvent]);
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'inspection_not_found' } });

    await expect(syncPendingDocumentAcknowledgements()).resolves.toEqual({ success: 0, failed: 1 });

    expect(databaseMock.markAcknowledgementFailed).toHaveBeenCalledWith(pendingEvent.id, 'inspection_not_synced');
  });

  it('encerra a tentativa local quando a mesma versão já foi finalizada pela web', async () => {
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([pendingEvent]);
    mockRpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'document_already_acknowledged' } });

    await expect(syncPendingDocumentAcknowledgements()).resolves.toEqual({ success: 0, failed: 0 });

    expect(databaseMock.markAcknowledgementSuperseded).toHaveBeenCalledWith(pendingEvent.id);
    expect(databaseMock.markAcknowledgementFailed).not.toHaveBeenCalled();
  });

  it('persiste a assinatura enviada mesmo quando a finalização falha', async () => {
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([pendingEvent]);
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0002', message: 'inspection_not_found' } });

    await syncPendingDocumentAcknowledgements();

    expect(databaseMock.markAcknowledgementSignatureUploaded).toHaveBeenCalledWith(
      pendingEvent.id,
      'user/vistoria/document/signature.json'
    );
  });

  it('recusa documento remoto cujo hash não confere com a versão registrada', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    }) as any;
    try {
      await expect(verifyDocumentIntegrity({ ...document, pdfLocalUri: null, remotePath: 'user/vistoria/document/document.pdf' })).resolves.toBe(true);
      const integrityMock = require('../../utils/documentIntegrity');
      integrityMock.sha256Bytes.mockResolvedValueOnce('0'.repeat(64));
      await expect(verifyDocumentIntegrity({ ...document, pdfLocalUri: null, remotePath: 'user/vistoria/document/document.pdf' })).resolves.toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('preserva falha de autorização para tratamento controlado', async () => {
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([pendingEvent]);
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'document_scope_denied' } });
    await expect(syncPendingDocumentAcknowledgements()).resolves.toEqual({ success: 0, failed: 1 });
    expect(databaseMock.markAcknowledgementFailed).toHaveBeenCalledWith(pendingEvent.id, 'authorization_denied');
  });
});
