export type DocumentPreparationResult = {
  documentId: string | null;
  enabled: boolean;
  errorMessage: string | null;
};

export type DocumentReleaseDecision = 'collect_acknowledgement' | 'share' | 'blocked';

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
