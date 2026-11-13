/** Science belongs to the preserved version, including its preliminary status. */
export function isPreliminaryInspectionDocument(snapshot: string): boolean {
  try {
    const value = JSON.parse(snapshot);
    return value?.payload?.documentStatus === 'preliminary' || value?.payload?.issuance_status === 'preliminary';
  } catch { return false; }
}

/** Official protocol means a remote record exists even while photos are pending. */
export function canDiscardUnsynchronizedInspection(input: { protocolo?: string | null; sincronizado: number }): boolean {
  return input.sincronizado === 0 && !input.protocolo?.trim();
}

/** Role alone never proves technical authorship or evidence completeness. */
export function resolveInspectionDocumentPolicy(input: {
  authorId: string | null | undefined;
  actorId: string | null | undefined;
  mediaPending: number | null;
  mediaKnown: boolean;
  mediaWaived?: boolean;
}): { canSignAsAuthor: boolean; documentStatus: 'preliminary' | 'final' } {
  const canSignAsAuthor = Boolean(input.authorId && input.actorId && input.authorId === input.actorId);
  return {
    canSignAsAuthor,
    documentStatus: canSignAsAuthor && ((input.mediaKnown && input.mediaPending === 0) || input.mediaWaived === true) ? 'final' : 'preliminary',
  };
}
