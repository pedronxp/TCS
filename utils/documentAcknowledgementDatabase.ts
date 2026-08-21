import { ensureDocumentAcknowledgementSchema } from './database';
import {
  AcknowledgementHistoryStatus,
  LocalAcknowledgementEvent,
  LocalGeneratedDocument,
} from '../types/documentAcknowledgement';

interface DocumentRow {
  id: string;
  vistoria_id: string;
  document_type: LocalGeneratedDocument['documentType'];
  document_version: number;
  template_version: string;
  content_snapshot: string;
  content_hash: string;
  pdf_hash: string;
  pdf_local_uri: string | null;
  preview_html: string;
  remote_path: string | null;
  byte_size: number;
  created_by: string;
  created_at_device: string;
  training_mode: number;
  status: LocalGeneratedDocument['status'];
  supersedes_id: string | null;
}

interface EventRow {
  id: string;
  client_event_id: string;
  document_id: string;
  outcome: LocalAcknowledgementEvent['outcome'];
  declaration_version: string;
  declaration_text: string;
  declaration_hash: string;
  recipient_name: string;
  recipient_relationship: string;
  signature_strokes: string | null;
  signature_hash: string | null;
  reason: string | null;
  witness_json: string | null;
  occurred_at_device: string;
  recorded_at_server: string | null;
  device_id_hash: string | null;
  created_by: string;
  sync_status: LocalAcknowledgementEvent['syncStatus'];
  protocol: string | null;
  remote_signature_path: string | null;
  error_code: string | null;
  attempts: number;
  training_mode: number;
  correction_of: string | null;
  correction_reason: string | null;
}

function mapDocument(row: DocumentRow): LocalGeneratedDocument {
  return {
    id: row.id,
    vistoriaId: row.vistoria_id,
    documentType: row.document_type,
    documentVersion: row.document_version,
    templateVersion: row.template_version,
    contentSnapshot: row.content_snapshot,
    contentHash: row.content_hash,
    pdfHash: row.pdf_hash,
    pdfLocalUri: row.pdf_local_uri,
    previewHtml: row.preview_html,
    remotePath: row.remote_path,
    byteSize: row.byte_size,
    createdBy: row.created_by,
    createdAtDevice: row.created_at_device,
    trainingMode: row.training_mode === 1,
    status: row.status,
    supersedesId: row.supersedes_id,
  };
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function mapEvent(row: EventRow): LocalAcknowledgementEvent {
  return {
    id: row.id,
    clientEventId: row.client_event_id,
    documentId: row.document_id,
    outcome: row.outcome,
    declarationVersion: row.declaration_version,
    declarationText: row.declaration_text,
    declarationHash: row.declaration_hash,
    recipientName: row.recipient_name,
    recipientRelationship: row.recipient_relationship,
    signatureStrokes: parseJson(row.signature_strokes),
    signatureHash: row.signature_hash,
    reason: row.reason,
    witness: parseJson(row.witness_json),
    occurredAtDevice: row.occurred_at_device,
    recordedAtServer: row.recorded_at_server,
    deviceIdHash: row.device_id_hash,
    createdBy: row.created_by,
    syncStatus: row.sync_status,
    protocol: row.protocol,
    remoteSignaturePath: row.remote_signature_path,
    errorCode: row.error_code,
    attempts: row.attempts,
    trainingMode: row.training_mode === 1,
    correctionOf: row.correction_of,
    correctionReason: row.correction_reason,
  };
}

export function saveGeneratedDocument(document: LocalGeneratedDocument): void {
  const db = ensureDocumentAcknowledgementSchema();
  db.withTransactionSync(() => {
    db.runSync(
      `UPDATE generated_documents_local
          SET status = 'superseded'
        WHERE vistoria_id = ? AND document_type = ? AND status <> 'superseded'`,
      [document.vistoriaId, document.documentType]
    );
    db.runSync(
      `INSERT INTO generated_documents_local (
        id, vistoria_id, document_type, document_version, template_version,
        content_snapshot, content_hash, pdf_hash, pdf_local_uri, preview_html,
        remote_path, byte_size, created_by, created_at_device, training_mode,
        status, supersedes_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        document.id, document.vistoriaId, document.documentType,
        document.documentVersion, document.templateVersion, document.contentSnapshot,
        document.contentHash, document.pdfHash, document.pdfLocalUri,
        document.previewHtml, document.remotePath, document.byteSize,
        document.createdBy, document.createdAtDevice, document.trainingMode ? 1 : 0,
        document.status, document.supersedesId,
      ]
    );
  });
}

export function getNextDocumentVersion(
  vistoriaId: string,
  documentType: LocalGeneratedDocument['documentType']
): { version: number; supersedesId: string | null } {
  const row = ensureDocumentAcknowledgementSchema().getFirstSync<{ id: string; document_version: number }>(
    `SELECT id, document_version FROM generated_documents_local
      WHERE vistoria_id = ? AND document_type = ?
      ORDER BY document_version DESC LIMIT 1`,
    [vistoriaId, documentType]
  );
  return { version: (row?.document_version ?? 0) + 1, supersedesId: row?.id ?? null };
}

export function findReusableGeneratedDocument(
  vistoriaId: string,
  documentType: LocalGeneratedDocument['documentType'],
  contentHash: string
): LocalGeneratedDocument | null {
  const row = ensureDocumentAcknowledgementSchema().getFirstSync<DocumentRow>(
    `SELECT * FROM generated_documents_local
      WHERE vistoria_id = ?
        AND document_type = ?
        AND content_hash = ?
        AND status <> 'superseded'
      ORDER BY document_version DESC LIMIT 1`,
    [vistoriaId, documentType, contentHash]
  );
  return row ? mapDocument(row) : null;
}

export function getGeneratedDocument(id: string): LocalGeneratedDocument | null {
  const row = ensureDocumentAcknowledgementSchema().getFirstSync<DocumentRow>(
    `SELECT * FROM generated_documents_local WHERE id = ?`,
    [id]
  );
  return row ? mapDocument(row) : null;
}

export function listGeneratedDocuments(vistoriaId: string): LocalGeneratedDocument[] {
  return ensureDocumentAcknowledgementSchema().getAllSync<DocumentRow>(
    `SELECT * FROM generated_documents_local
      WHERE vistoria_id = ? ORDER BY created_at_device DESC`,
    [vistoriaId]
  ).map(mapDocument);
}

export function updateGeneratedDocumentRemote(
  id: string,
  remotePath: string,
  status: LocalGeneratedDocument['status'] = 'available'
): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `UPDATE generated_documents_local SET remote_path = ?, status = ? WHERE id = ?`,
    [remotePath, status, id]
  );
}

export function clearGeneratedDocumentLocalFile(id: string): void {
  ensureDocumentAcknowledgementSchema().runSync(`UPDATE generated_documents_local SET pdf_local_uri = NULL WHERE id = ?`, [id]);
}

export function saveAcknowledgementEvent(event: LocalAcknowledgementEvent): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `INSERT INTO document_ack_events_local (
      id, client_event_id, document_id, outcome, declaration_version,
      declaration_text, declaration_hash, recipient_name, recipient_relationship,
      signature_strokes, signature_hash, reason, witness_json, occurred_at_device,
      recorded_at_server, device_id_hash, created_by, sync_status, protocol,
      remote_signature_path, error_code, attempts, training_mode, correction_of,
      correction_reason
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      event.id, event.clientEventId, event.documentId, event.outcome,
      event.declarationVersion, event.declarationText, event.declarationHash,
      event.recipientName, event.recipientRelationship,
      event.signatureStrokes ? JSON.stringify(event.signatureStrokes) : null,
      event.signatureHash, event.reason,
      event.witness ? JSON.stringify(event.witness) : null,
      event.occurredAtDevice, event.recordedAtServer, event.deviceIdHash,
      event.createdBy, event.syncStatus, event.protocol, event.remoteSignaturePath,
      event.errorCode, event.attempts, event.trainingMode ? 1 : 0,
      event.correctionOf, event.correctionReason,
    ]
  );
}

export function getAcknowledgementEvent(id: string): LocalAcknowledgementEvent | null {
  const row = ensureDocumentAcknowledgementSchema().getFirstSync<EventRow>(
    `SELECT * FROM document_ack_events_local WHERE id = ? OR client_event_id = ? LIMIT 1`,
    [id, id]
  );
  return row ? mapEvent(row) : null;
}

export function listAcknowledgementEventsForDocument(documentId: string): LocalAcknowledgementEvent[] {
  return ensureDocumentAcknowledgementSchema().getAllSync<EventRow>(
    `SELECT * FROM document_ack_events_local
      WHERE document_id = ? ORDER BY occurred_at_device DESC`,
    [documentId]
  ).map(mapEvent);
}

export function listAcknowledgementHistory(vistoriaId: string): Array<{
  document: LocalGeneratedDocument;
  event: LocalAcknowledgementEvent | null;
  historyStatus: AcknowledgementHistoryStatus;
}> {
  return listGeneratedDocuments(vistoriaId).map(document => {
    const event = listAcknowledgementEventsForDocument(document.id)[0] ?? null;
    let historyStatus: AcknowledgementHistoryStatus = 'not_collected';
    if (event?.syncStatus === 'failed') historyStatus = 'sync_failed';
    else if (event && event.syncStatus !== 'confirmed') historyStatus = 'pending_sync';
    else if (event?.outcome === 'acknowledged') historyStatus = 'confirmed';
    else if (event?.outcome === 'refused') historyStatus = 'refused';
    else if (event?.outcome === 'unable_to_sign') historyStatus = 'unable_to_sign';
    return { document, event, historyStatus };
  });
}

export function listPendingAcknowledgementEvents(limit = 20): LocalAcknowledgementEvent[] {
  return ensureDocumentAcknowledgementSchema().getAllSync<EventRow>(
    `SELECT * FROM document_ack_events_local
      WHERE sync_status IN ('pending','failed') AND attempts < 8 AND training_mode = 0
      ORDER BY occurred_at_device ASC LIMIT ?`,
    [limit]
  ).map(mapEvent);
}

export function markAcknowledgementSyncing(id: string): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `UPDATE document_ack_events_local
        SET sync_status = 'syncing', attempts = attempts + 1, error_code = NULL
      WHERE id = ?`,
    [id]
  );
}

export function markAcknowledgementFailed(id: string, errorCode: string): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `UPDATE document_ack_events_local SET sync_status = 'failed', error_code = ? WHERE id = ?`,
    [errorCode.slice(0, 120), id]
  );
}

export function markAcknowledgementSignatureUploaded(id: string, remoteSignaturePath: string): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `UPDATE document_ack_events_local
        SET remote_signature_path = ?, error_code = NULL
      WHERE id = ?`,
    [remoteSignaturePath, id]
  );
}

export function markAcknowledgementConfirmed(
  id: string,
  protocol: string,
  recordedAtServer: string,
  remoteSignaturePath: string | null
): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `UPDATE document_ack_events_local
        SET sync_status = 'confirmed', protocol = ?, recorded_at_server = ?,
            remote_signature_path = ?, error_code = NULL
      WHERE id = ?`,
    [protocol, recordedAtServer, remoteSignaturePath, id]
  );
}

export function retryAcknowledgementEvent(id: string): void {
  ensureDocumentAcknowledgementSchema().runSync(
    `UPDATE document_ack_events_local
        SET sync_status = 'pending', error_code = NULL, attempts = 0
      WHERE id = ? AND sync_status = 'failed'`,
    [id]
  );
}
