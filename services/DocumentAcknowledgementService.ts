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
  getNextDocumentVersion,
  listPendingAcknowledgementEvents,
  markAcknowledgementConfirmed,
  markAcknowledgementFailed,
  markAcknowledgementSignatureUploaded,
  markAcknowledgementSyncing,
  saveAcknowledgementEvent,
  saveGeneratedDocument,
  updateGeneratedDocumentRemote,
} from '../utils/documentAcknowledgementDatabase';
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

  // Reuse the active version when the immutable source content did not change.
  // This prevents repeated taps from creating an unlimited version sequence.
  const reusable = findReusableGeneratedDocument(input.vistoriaId, input.documentType, contentHash);
  if (reusable) return reusable;

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
    return document;
  } catch (error) {
    await FileSystem.deleteAsync(privatePdfUri, { idempotent: true }).catch(() => null);
    throw error;
  }
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
export async function publishGeneratedDocument(document: LocalGeneratedDocument): Promise<void> {
  if (document.trainingMode) throw new Error('training_document_cannot_be_shared');
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
