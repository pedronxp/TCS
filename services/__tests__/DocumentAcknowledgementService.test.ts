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
  getNextDocumentVersion: jest.fn().mockReturnValue({ version: 1, supersedesId: null }),
  listPendingAcknowledgementEvents: jest.fn(),
  markAcknowledgementConfirmed: jest.fn(),
  markAcknowledgementFailed: jest.fn(),
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
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({ logger: { warn: jest.fn() } }));

import {
  createAcknowledgementEvent,
  prepareGeneratedDocument,
  syncPendingDocumentAcknowledgements,
  verifyDocumentIntegrity,
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
  beforeEach(() => {
    jest.clearAllMocks();
    databaseMock.getGeneratedDocument.mockReturnValue(document);
    databaseMock.findReusableGeneratedDocument.mockReturnValue(null);
    databaseMock.getNextDocumentVersion.mockReturnValue({ version: 1, supersedesId: null });
    databaseMock.listPendingAcknowledgementEvents.mockReturnValue([]);
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
