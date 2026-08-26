export type DocumentPreparationResult = {
  documentId: string | null;
  enabled: boolean;
  errorMessage: string | null;
};

export type DocumentReleaseDecision = 'collect_acknowledgement' | 'share' | 'blocked';

export type AcknowledgementEvidenceState = {
  syncStatus: 'pending' | 'syncing' | 'confirmed' | 'failed';
  protocol: string | null;
};

export function resolveDocumentRelease(preparation: DocumentPreparationResult): DocumentReleaseDecision {
  if (preparation.documentId) return 'collect_acknowledgement';
  if (!preparation.enabled) return 'share';
  return 'blocked';
}

export function documentReleaseMessage(preparation: DocumentPreparationResult, documentLabel: string) {
  const decision = resolveDocumentRelease(preparation);
  if (decision === 'collect_acknowledgement') {
    return {
      title: `${documentLabel} preparado`,
      message: 'Apresente esta versão e registre o resultado da ciência antes de compartilhar.',
    };
  }
  if (decision === 'share') {
    return {
      title: `${documentLabel} preparado`,
      message: 'A ciência eletrônica está desabilitada para este documento.',
    };
  }
  return {
    title: `${documentLabel} não liberado`,
    message: 'A versão usada na ciência não foi preservada. Tente gerar novamente antes de compartilhar.',
  };
}

export function canReleaseAcknowledgementEvidence(event: AcknowledgementEvidenceState): boolean {
  return event.syncStatus === 'confirmed' && Boolean(event.protocol?.trim());
}

export async function syncPreparedDocumentBatch<T>(
  documents: readonly T[],
  publish: (document: T) => Promise<void>,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const document of documents) {
    try {
      await publish(document);
      success += 1;
    } catch {
      failed += 1;
    }
  }
  return { success, failed };
}
