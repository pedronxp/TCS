import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { supabase, supabaseUrl } from '../utils/supabase';
import { generateUUID } from '../utils/uuid';
import {
  canonicalize,
  createDocumentSnapshot,
  hasMinimumSignature,
  hashCanonical,
  normalizeSignatureStrokes,
  sha256Bytes,
  sha256File,
  sha256String,
} from '../utils/documentIntegrity';
import {
  clearGeneratedDocumentLocalFile,
  findReusableGeneratedDocument,
  getGeneratedDocument,
  getAcknowledgementEvent,
  refreshRemoteDocumentPreview,
  reconcileRemoteDocumentAvailability,
  getNextDocumentVersion,
  listPendingAcknowledgementEvents,
  listPendingGeneratedDocuments,
  markAcknowledgementConfirmed,
  markAcknowledgementFailed,
  markAcknowledgementSuperseded,
  markAcknowledgementSignatureUploaded,
  markAcknowledgementSyncing,
  saveAcknowledgementEvent,
  saveGeneratedDocument,
  updateGeneratedDocumentRemote,
} from '../utils/documentAcknowledgementDatabase';
import { isFinalOutcomeConflict, syncPreparedDocumentBatch } from './DocumentReleaseWorkflow';
import {
  CreateAcknowledgementInput,
  DocumentContentSnapshot,
  GeneratedDocumentType,
  LocalAcknowledgementEvent,
  LocalGeneratedDocument,
} from '../types/documentAcknowledgement';
import {
  encodeDocumentEvidencePath,
  getSignedUrl,
  uploadDocumentEvidenceFile,
  uploadDocumentSignatureEvidence,
} from './StorageService';
import { logger } from '../utils/logger';

interface PrepareGeneratedDocumentInput<TPayload extends object> {
  vistoriaId: string;
  documentType: GeneratedDocumentType;
  templateVersion: string;
  payload: TPayload;
  pdfUri: string;
  previewHtml: string;
  createdBy: string;
  trainingMode?: boolean;
}

interface FinalizationResult {
  event_id: string;
  protocol: string;
  recorded_at_server: string;
  signature_storage_path: string | null;
  idempotent: boolean;
}

export interface RemoteAcknowledgementHistoryEvent {
  id: string;
  event_kind: 'outcome' | 'corrected' | 'invalidated';
  outcome: string | null;
  protocol: string;
  correction_reason: string | null;
  recorded_at_server: string;
  created_by: string;
}

const ACK_DEVICE_ID_KEY = 'tcs_acknowledgement_device_id_v1';

async function resolveDeviceIdHash(explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  try {
    let localId = await SecureStore.getItemAsync(ACK_DEVICE_ID_KEY);
    if (!localId) {
      localId = generateUUID();
      await SecureStore.setItemAsync(ACK_DEVICE_ID_KEY, localId);
    }
    return sha256String(localId);
  } catch {
    return null;
  }
}

export async function prepareGeneratedDocument<TPayload extends object>(
  input: PrepareGeneratedDocumentInput<TPayload>
): Promise<LocalGeneratedDocument> {
  const snapshot = createDocumentSnapshot(
    input.documentType,
    input.templateVersion,
    input.vistoriaId,
    Boolean(input.trainingMode),
    input.payload
  );
  const contentSnapshot = canonicalize(snapshot);
  const contentHash = await hashCanonical(snapshot);
  const confirmFinalIssuance = async (prepared: LocalGeneratedDocument): Promise<LocalGeneratedDocument> => {
    if (!input.trainingMode && (input.payload as { documentStatus?: unknown }).documentStatus === 'final') {
      const remotePath = await publishGeneratedDocument(prepared);
      return { ...prepared, remotePath, status: 'available' };
    }
    return prepared;
  };

  // Reuse the active version when the immutable source content did not change.
  // This prevents repeated taps from creating an unlimited version sequence.
  const reusable = findReusableGeneratedDocument(input.vistoriaId, input.documentType, contentHash);
  if (reusable) return confirmFinalIssuance(reusable);

  const documentId = generateUUID();
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) throw new Error('Diretório privado do aplicativo indisponível');
  const privateDirectory = `${documentDirectory}document-evidence/`;
  const privatePdfUri = `${privateDirectory}${documentId}.pdf`;

  await FileSystem.makeDirectoryAsync(privateDirectory, { intermediates: true });
  const sourceInfo = await FileSystem.getInfoAsync(input.pdfUri);
  if (!sourceInfo.exists) throw new Error('Arquivo do documento não foi encontrado');
  await FileSystem.deleteAsync(privatePdfUri, { idempotent: true });
  await FileSystem.copyAsync({ from: input.pdfUri, to: privatePdfUri });

  const pdf = await sha256File(privatePdfUri);
  const next = getNextDocumentVersion(input.vistoriaId, input.documentType);
  const document: LocalGeneratedDocument = {
    id: documentId,
    vistoriaId: input.vistoriaId,
    documentType: input.documentType,
    documentVersion: next.version,
    templateVersion: input.templateVersion,
    contentSnapshot,
    contentHash,
    pdfHash: pdf.hash,
    pdfLocalUri: privatePdfUri,
    previewHtml: input.previewHtml,
    remotePath: null,
    byteSize: pdf.byteSize,
    createdBy: input.createdBy,
    createdAtDevice: new Date().toISOString(),
    trainingMode: Boolean(input.trainingMode),
    status: 'pending_upload',
    supersedesId: next.supersedesId,
  };
  try {
    saveGeneratedDocument(document);
  } catch (error) {
    await FileSystem.deleteAsync(privatePdfUri, { idempotent: true }).catch(() => null);
    throw error;
  }
  // A publication failure retains the local package for recovery, but does not
  // release a final document before the server validates signature and media.
  return confirmFinalIssuance(document);
}

export async function createAcknowledgementEvent(
  input: CreateAcknowledgementInput
): Promise<LocalAcknowledgementEvent> {
  const document = getGeneratedDocument(input.documentId);
  if (!document) throw new Error('Documento não encontrado neste dispositivo');
  const name = input.recipientName.trim();
  const relationship = input.recipientRelationship.trim();
  if (name.length < 2 || relationship.length < 2) {
    throw new Error('Informe o nome e a relação do destinatário com o atendimento');
  }
  if (input.outcome === 'acknowledged' && !input.declarationAccepted) {
    throw new Error('A declaração precisa ser confirmada antes da ciência');
  }
  const normalizedSignature = input.signatureStrokes
    ? normalizeSignatureStrokes(input.signatureStrokes)
    : null;
  if (input.outcome === 'acknowledged' && (!normalizedSignature || !hasMinimumSignature(normalizedSignature))) {
    throw new Error('A assinatura está vazia ou incompleta');
  }
  const reason = input.reason?.trim() || null;
  if (input.outcome !== 'acknowledged' && (!reason || reason.length < 3)) {
    throw new Error('Informe o motivo da recusa ou impossibilidade');
  }
  if (input.witnessRequired && (!input.witness?.name || input.witness.name.trim().length < 2)) {
    throw new Error('A política desta coleta exige uma testemunha');
  }
  const [declarationHash, signatureHash, deviceIdHash] = await Promise.all([
    hashCanonical(input.declaration),
    normalizedSignature ? hashCanonical(normalizedSignature) : Promise.resolve(null),
    resolveDeviceIdHash(input.deviceIdHash),
  ]);
  const eventId = generateUUID();
  const trainingMode = Boolean(input.trainingMode || document.trainingMode);
  const event: LocalAcknowledgementEvent = {
    id: eventId,
    clientEventId: generateUUID(),
    documentId: document.id,
    outcome: input.outcome,
    declarationVersion: input.declaration.version,
    declarationText: input.declaration.text,
    declarationHash,
    recipientName: name,
    recipientRelationship: relationship,
    signatureStrokes: input.outcome === 'acknowledged' ? normalizedSignature : null,
    signatureHash: input.outcome === 'acknowledged' ? signatureHash : null,
    reason: input.outcome === 'acknowledged' ? null : reason,
    witness: input.witness ?? null,
    occurredAtDevice: new Date().toISOString(),
    recordedAtServer: trainingMode ? new Date().toISOString() : null,
    deviceIdHash,
    createdBy: input.createdBy,
    syncStatus: trainingMode ? 'confirmed' : 'pending',
    protocol: trainingMode ? `TREINAMENTO-${eventId.slice(0, 8).toUpperCase()}` : null,
    remoteSignaturePath: null,
    errorCode: null,
    attempts: 0,
    trainingMode,
    correctionOf: null,
    correctionReason: null,
  };
  saveAcknowledgementEvent(event);
  return event;
}

function classifySyncError(error: unknown): string {
  const candidate = error as { code?: string; message?: string };
  const code = candidate?.code || '';
  const message = candidate?.message || '';
  if (code === '42501' || /denied|authorization|permission/i.test(message)) return 'authorization_denied';
  if (code === 'P0002' && /inspection_not_found|vistoria/i.test(message)) return 'inspection_not_synced';
  if (code === 'P0002' || /not_found|not found/i.test(message)) return 'document_not_found';
  if (code === '22023' || /invalid|required/i.test(message)) return 'invalid_evidence';
  if (/network|fetch|timeout/i.test(message)) return 'network_error';
  return 'sync_error';
}

async function ensureDocumentUploaded(document: LocalGeneratedDocument): Promise<string> {
  if (document.remotePath) return document.remotePath;
  if (!document.pdfLocalUri) throw new Error('document_file_missing');
  const path = await uploadDocumentEvidenceFile(
    document.pdfLocalUri,
    document.createdBy,
    document.vistoriaId,
    document.id
  );
  updateGeneratedDocumentRemote(document.id, path, 'pending_upload');
  return path;
}

/** Publica somente a versão imutável do documento, sem criar um evento de ciência. */
export async function publishGeneratedDocument(document: LocalGeneratedDocument): Promise<string> {
  if (document.trainingMode) throw new Error('training_document_cannot_be_shared');
  if (document.status === 'available' && document.remotePath) return document.remotePath;
  const storagePath = await ensureDocumentUploaded(document);
  const snapshot = JSON.parse(document.contentSnapshot) as DocumentContentSnapshot;
  const { error } = await supabase.rpc('register_generated_document', {
    p_payload: {
      document_id: document.id,
      vistoria_id: document.vistoriaId,
      document_type: document.documentType,
      document_version: document.documentVersion,
      template_version: document.templateVersion,
      content_snapshot: snapshot,
      content_hash: document.contentHash,
      pdf_hash: document.pdfHash,
      storage_path: storagePath,
      byte_size: document.byteSize,
      supersedes_id: document.supersedesId,
      training_mode: false,
      document_created_at_device: document.createdAtDevice,
    },
  });
  if (error) throw error;
  updateGeneratedDocumentRemote(document.id, storagePath, 'available');
  return storagePath;
}

export async function syncPreparedGeneratedDocuments(): Promise<{ success: number; failed: number }> {
  return syncPreparedDocumentBatch(listPendingGeneratedDocuments(), async (document) => {
    try {
      await publishGeneratedDocument(document);
    } catch (error) {
      logger.warn('sync', 'Falha ao publicar versão documental preparada', {
        documentId: document.id,
        vistoriaId: document.vistoriaId,
        erro: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}

export async function createRemoteAcknowledgementLink(
  document: LocalGeneratedDocument,
  expiresInHours = 72,
): Promise<{ token: string; expiresAt: string }> {
  await publishGeneratedDocument(document);
  const { data, error } = await supabase.rpc('create_document_acknowledgement_link', {
    p_document_id: document.id,
    p_expires_in_hours: expiresInHours,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.token || !result?.expires_at) throw new Error('remote_link_creation_failed');
  return {
    token: result.token as string,
    expiresAt: result.expires_at as string,
  };
}

export function remoteAcknowledgementUrl(token: string): string {
  const baseUrl = process.env.EXPO_PUBLIC_DOCUMENT_ACKNOWLEDGEMENT_BASE_URL || 'https://tcsvistoria.pages.dev';
  return `${baseUrl.replace(/\/$/, '')}/ciencia/${encodeURIComponent(token)}`;
}

async function cleanupConfirmedDocument(document: LocalGeneratedDocument, remotePath: string): Promise<void> {
  if (!document.pdfLocalUri) return;
  const signed = await getSignedUrl(encodeDocumentEvidencePath(remotePath), 60);
  if (!signed) return;
  const file = new File(document.pdfLocalUri);
  if (file.exists) file.delete();
  clearGeneratedDocumentLocalFile(document.id);
}

export async function syncPendingDocumentAcknowledgements(): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const event of listPendingAcknowledgementEvents()) {
    const document = getGeneratedDocument(event.documentId);
    if (!document || document.trainingMode) continue;
    markAcknowledgementSyncing(event.id);
    try {
      const storagePath = await ensureDocumentUploaded(document);
      const signatureStoragePath = event.remoteSignaturePath ?? (event.signatureStrokes
        ? await uploadDocumentSignatureEvidence(
            canonicalize(event.signatureStrokes),
            event.createdBy,
            document.vistoriaId,
            document.id
          )
        : null);
      if (!event.remoteSignaturePath && signatureStoragePath) {
        markAcknowledgementSignatureUploaded(event.id, signatureStoragePath);
      }
      const snapshot = JSON.parse(document.contentSnapshot) as DocumentContentSnapshot;
      const { data, error } = await supabase.rpc('finalize_document_acknowledgement', {
        p_payload: {
          event_id: event.id,
          client_event_id: event.clientEventId,
          document_id: document.id,
          vistoria_id: document.vistoriaId,
          document_type: document.documentType,
          document_version: document.documentVersion,
          template_version: document.templateVersion,
          content_snapshot: snapshot,
          content_hash: document.contentHash,
          pdf_hash: document.pdfHash,
          storage_path: storagePath,
          byte_size: document.byteSize,
          supersedes_id: document.supersedesId,
          training_mode: false,
          document_created_at_device: document.createdAtDevice,
          outcome: event.outcome,
          declaration_version: event.declarationVersion,
          declaration_text: event.declarationText,
          declaration_hash: event.declarationHash,
          recipient_name: event.recipientName,
          recipient_relationship: event.recipientRelationship,
          signature_strokes: event.signatureStrokes,
          signature_hash: event.signatureHash,
          signature_storage_path: signatureStoragePath,
          reason: event.reason,
          witness: event.witness,
          witness_required: Boolean(event.witness),
          occurred_at_device: event.occurredAtDevice,
          device_id_hash: event.deviceIdHash,
        },
      });
      if (error) throw error;
      const result = data as FinalizationResult;
      updateGeneratedDocumentRemote(document.id, storagePath, 'available');
      markAcknowledgementConfirmed(
        event.id,
        result.protocol,
        result.recorded_at_server,
        result.signature_storage_path
      );
      await cleanupConfirmedDocument(document, storagePath);
      success += 1;
    } catch (error) {
      if (isFinalOutcomeConflict(error)) {
        markAcknowledgementSuperseded(event.id);
        logger.warn('sync', 'Tentativa local encerrada porque a versão já possui resultado no servidor', {
          eventId: event.id,
          documentId: document.id,
        });
        continue;
      }
      const errorCode = classifySyncError(error);
      markAcknowledgementFailed(event.id, errorCode);
      logger.warn('sync', 'Falha ao sincronizar ciência eletrônica', {
        eventId: event.id,
        documentId: document.id,
        errorCode,
      });
      failed += 1;
    }
  }
  return { success, failed };
}

export async function verifyLocalDocumentIntegrity(document: LocalGeneratedDocument): Promise<boolean> {
  if (!document.pdfLocalUri) return false;
  try {
    const current = await sha256File(document.pdfLocalUri);
    return current.hash === document.pdfHash;
  } catch {
    return false;
  }
}

export async function verifyDocumentIntegrity(document: LocalGeneratedDocument): Promise<boolean> {
  if (document.pdfLocalUri) return verifyLocalDocumentIntegrity(document);
  if (!document.remotePath) return false;
  try {
    const signed = await getSignedUrl(encodeDocumentEvidencePath(document.remotePath), 120);
    if (!signed) return false;
    const response = await fetch(signed);
    if (!response.ok) return false;
    const hash = await sha256Bytes(new Uint8Array(await response.arrayBuffer()));
    return hash === document.pdfHash;
  } catch {
    return false;
  }
}

const remoteDocumentLoads = new Map<string, Promise<LocalGeneratedDocument[]>>();

/** Import only authorized, already-preserved versions. Never re-create a PDF on behalf of its author. */
export async function loadRemoteInspectionDocuments(inspectionId: string): Promise<LocalGeneratedDocument[]> {
  const session = await supabase.auth.getSession();
  const actorUid = session.data.session?.user.id;
  if (session.error || !actorUid) throw new Error('Sessão autenticada necessária para abrir documentos de outra vistoria.');
  const key = `${actorUid}:${inspectionId}`;
  const existing = remoteDocumentLoads.get(key);
  if (existing) return existing;
  const request = importRemoteInspectionDocuments(inspectionId, actorUid);
  remoteDocumentLoads.set(key, request);
  try {
    return await request;
  } finally {
    remoteDocumentLoads.delete(key);
  }
}

async function importRemoteInspectionDocuments(inspectionId: string, actorUid: string): Promise<LocalGeneratedDocument[]> {
  const ensureSameActor = async () => {
    const current = await supabase.auth.getSession();
    if (current.error || current.data.session?.user.id !== actorUid) throw new Error('A sessão mudou durante o carregamento do documento.');
  };
  const { data, error } = await supabase.from('generated_documents')
    .select('id,vistoria_id,document_type,document_version,template_version,content_snapshot,content_hash,pdf_hash,storage_path,byte_size,created_by,created_at_device,training_mode,status,supersedes_id')
    .eq('vistoria_id', inspectionId).eq('training_mode', false).eq('status', 'available')
    .order('document_version', { ascending: true });
  if (error) throw error;
  await ensureSameActor();
  const loaded: LocalGeneratedDocument[] = [];
  reconcileRemoteDocumentAvailability(inspectionId, (data ?? []).map(row => row.id));
  for (const row of data ?? []) {
    const signed = await getSignedUrl(encodeDocumentEvidencePath(row.storage_path), 3600);
    if (!signed) throw new Error('Não foi possível abrir a versão preservada do documento.');
    const safeUrl = signed.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const document: LocalGeneratedDocument = {
      id: row.id, vistoriaId: row.vistoria_id, documentType: row.document_type,
      documentVersion: row.document_version, templateVersion: row.template_version,
      contentSnapshot: typeof row.content_snapshot === 'string' ? row.content_snapshot : JSON.stringify(row.content_snapshot),
      contentHash: row.content_hash, pdfHash: row.pdf_hash, pdfLocalUri: null,
      previewHtml: `<!doctype html><html lang="pt-BR"><body style="margin:0"><iframe title="Documento preservado" src="${safeUrl}" style="border:0;width:100%;height:100vh"></iframe></body></html>`,
      remotePath: row.storage_path, byteSize: row.byte_size, createdBy: row.created_by,
      createdAtDevice: row.created_at_device, trainingMode: false, status: 'available', supersedesId: row.supersedes_id ?? null,
    };
    await ensureSameActor();
    if (getGeneratedDocument(row.id)) refreshRemoteDocumentPreview(row.id, document.previewHtml);
    else saveGeneratedDocument(document);
    await SecureStore.setItemAsync(`document_access_${actorUid}_${row.id}`, 'granted');
    loaded.push(document);
  }
  if (loaded.length) {
    const events = await supabase.from('document_acknowledgement_events').select('*').in('document_id', loaded.map(d => d.id)).eq('event_kind', 'outcome');
    if (events.error) throw events.error;
    for (const row of events.data ?? []) {
      await ensureSameActor();
      if (getAcknowledgementEvent(row.id)) continue;
      saveAcknowledgementEvent({
        id: row.id, clientEventId: row.client_event_id, documentId: row.document_id, outcome: row.outcome,
        declarationVersion: row.declaration_version, declarationText: row.declaration_text, declarationHash: row.declaration_hash,
        recipientName: row.recipient_name, recipientRelationship: row.recipient_relationship,
        signatureStrokes: row.signature_strokes ?? null, signatureHash: row.signature_hash ?? null,
        reason: row.reason ?? null, witness: row.witness ?? null, occurredAtDevice: row.occurred_at_device,
        recordedAtServer: row.recorded_at_server, deviceIdHash: row.device_id_hash ?? null, createdBy: row.created_by,
        syncStatus: 'confirmed', protocol: row.protocol, remoteSignaturePath: row.signature_storage_path ?? null,
        errorCode: null, attempts: 0, trainingMode: false, correctionOf: null, correctionReason: null,
      });
    }
  }
  return loaded;
}

/** A cached imported PDF is not globally visible to every account on the phone. */
export async function hasImportedDocumentAccess(actorUid: string, documentId: string): Promise<boolean> {
  if (!actorUid || !documentId) return false;
  return (await SecureStore.getItemAsync(`document_access_${actorUid}_${documentId}`)) === 'granted';
}

export async function fetchRemoteAcknowledgementHistory(
  documentId: string
): Promise<RemoteAcknowledgementHistoryEvent[]> {
  const { data, error } = await supabase
    .from('document_acknowledgement_events')
    .select('id,event_kind,outcome,protocol,correction_reason,recorded_at_server,created_by')
    .eq('document_id', documentId)
    .order('recorded_at_server', { ascending: false });
  if (error) return [];
  return (data ?? []) as RemoteAcknowledgementHistoryEvent[];
}

export async function appendAcknowledgementCorrection(
  originalEventId: string,
  action: 'corrected' | 'invalidated',
  reason: string
): Promise<void> {
  const normalized = reason.trim();
  if (normalized.length < 5) throw new Error('Informe um motivo com pelo menos 5 caracteres');
  const { error } = await supabase.rpc('append_document_acknowledgement_correction', {
    p_original_event_id: originalEventId,
    p_action: action,
    p_reason: normalized,
  });
  if (error) throw error;
}
