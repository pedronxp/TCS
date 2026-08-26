export type GeneratedDocumentType = 'report' | 'technical_report' | 'interdiction_term';

export type GeneratedDocumentStatus = 'pending_upload' | 'available' | 'superseded';

export type AcknowledgementOutcome =
  | 'acknowledged'
  | 'refused'
  | 'unable_to_sign';

export type AcknowledgementSyncStatus =
  | 'pending'
  | 'syncing'
  | 'confirmed'
  | 'superseded'
  | 'failed';

export type AcknowledgementHistoryStatus =
  | 'not_collected'
  | 'pending_sync'
  | 'confirmed'
  | 'refused'
  | 'unable_to_sign'
  | 'superseded'
  | 'sync_failed';

export interface SignaturePoint {
  x: number;
  y: number;
}

export interface SignatureStroke {
  points: SignaturePoint[];
}

export interface WitnessEvidence {
  name: string;
  confirmation: 'present';
}

export interface DocumentDeclaration {
  version: string;
  text: string;
}

export interface DocumentContentSnapshot<TPayload = Record<string, unknown>> {
  documentType: GeneratedDocumentType;
  templateVersion: string;
  vistoriaId: string;
  trainingMode: boolean;
  payload: TPayload;
}

export interface LocalGeneratedDocument {
  id: string;
  vistoriaId: string;
  documentType: GeneratedDocumentType;
  documentVersion: number;
  templateVersion: string;
  contentSnapshot: string;
  contentHash: string;
  pdfHash: string;
  pdfLocalUri: string | null;
  previewHtml: string;
  remotePath: string | null;
  byteSize: number;
  createdBy: string;
  createdAtDevice: string;
  trainingMode: boolean;
  status: GeneratedDocumentStatus;
  supersedesId: string | null;
}

export interface LocalAcknowledgementEvent {
  id: string;
  clientEventId: string;
  documentId: string;
  outcome: AcknowledgementOutcome;
  declarationVersion: string;
  declarationText: string;
  declarationHash: string;
  recipientName: string;
  recipientRelationship: string;
  signatureStrokes: SignatureStroke[] | null;
  signatureHash: string | null;
  reason: string | null;
  witness: WitnessEvidence | null;
  occurredAtDevice: string;
  recordedAtServer: string | null;
  deviceIdHash: string | null;
  createdBy: string;
  syncStatus: AcknowledgementSyncStatus;
  protocol: string | null;
  remoteSignaturePath: string | null;
  errorCode: string | null;
  attempts: number;
  trainingMode: boolean;
  correctionOf: string | null;
  correctionReason: string | null;
}

export interface CreateAcknowledgementInput {
  documentId: string;
  outcome: AcknowledgementOutcome;
  declaration: DocumentDeclaration;
  declarationAccepted: boolean;
  recipientName: string;
  recipientRelationship: string;
  signatureStrokes?: SignatureStroke[] | null;
  reason?: string | null;
  witness?: WitnessEvidence | null;
  witnessRequired?: boolean;
  deviceIdHash?: string | null;
  createdBy: string;
  trainingMode?: boolean;
}

export interface AcknowledgementCorrection {
  originalEventId: string;
  reason: string;
  action: 'corrected' | 'invalidated';
}

export const DOCUMENT_TEMPLATE_VERSIONS: Record<GeneratedDocumentType, string> = {
  report: 'report-v3',
  technical_report: 'technical-report-v3',
  interdiction_term: 'interdiction-term-v3',
};

export const INITIAL_ACKNOWLEDGEMENT_DECLARATION: DocumentDeclaration = {
  version: 'tcs-ack-v1',
  text:
    'Declaro que tive acesso ao documento apresentado, recebi as orientações nele registradas e estou ciente de seu conteúdo. Esta ciência registra o recebimento e não substitui assinatura digital qualificada.',
};

const acknowledgementFlag = process.env.EXPO_PUBLIC_ELECTRONIC_ACKNOWLEDGEMENT;
const acknowledgementEnabled = acknowledgementFlag === 'true'
  || (process.env.NODE_ENV !== 'production' && acknowledgementFlag !== 'false');
const configuredDocumentTypes = new Set(
  (process.env.EXPO_PUBLIC_ELECTRONIC_ACKNOWLEDGEMENT_TYPES
    || 'report,technical_report,interdiction_term')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean)
);
const configuredOrganizations = new Set(
  (process.env.EXPO_PUBLIC_ELECTRONIC_ACKNOWLEDGEMENT_ORGANIZATIONS || '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean)
);

export const ACKNOWLEDGEMENT_FEATURE_FLAGS: Record<GeneratedDocumentType, boolean> = {
  report: acknowledgementEnabled && configuredDocumentTypes.has('report'),
  technical_report: acknowledgementEnabled && configuredDocumentTypes.has('technical_report'),
  interdiction_term: acknowledgementEnabled && configuredDocumentTypes.has('interdiction_term'),
};

export function isAcknowledgementEnabled(
  documentType: GeneratedDocumentType,
  organizationId?: string | null,
  trainingMode = false
): boolean {
  if (!ACKNOWLEDGEMENT_FEATURE_FLAGS[documentType]) return false;
  if (trainingMode) return true;
  return configuredOrganizations.size === 0
    || Boolean(organizationId && configuredOrganizations.has(organizationId));
}
