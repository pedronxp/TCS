import { canDiscardUnsynchronizedInspection, isPreliminaryInspectionDocument, resolveInspectionDocumentPolicy } from '../InspectionDocumentPolicy';

describe('inspection document authorship', () => {
  it('science identifies the preserved preliminary version from its snapshot', () => {
    expect(isPreliminaryInspectionDocument(JSON.stringify({ payload: { documentStatus: 'preliminary' } }))).toBe(true);
    expect(isPreliminaryInspectionDocument(JSON.stringify({ payload: { documentStatus: 'final' } }))).toBe(false);
    expect(isPreliminaryInspectionDocument('broken JSON')).toBe(false);
  });
  it('partial sync with official protocol cannot be discarded as a local draft', () => {
    expect(canDiscardUnsynchronizedInspection({ protocolo: 'TCS-2026-1', sincronizado: 0 })).toBe(false);
    expect(canDiscardUnsynchronizedInspection({ protocolo: null, sincronizado: 0 })).toBe(true);
    expect(canDiscardUnsynchronizedInspection({ protocolo: null, sincronizado: 1 })).toBe(false);
  });
  it('owner generating Pedro inspection cannot sign as Pedro', () => {
    expect(resolveInspectionDocumentPolicy({ authorId: 'pedro', actorId: 'owner', mediaPending: 0, mediaKnown: true }))
      .toEqual({ canSignAsAuthor: false, documentStatus: 'preliminary' });
  });
  it('unknown author cannot be silently replaced by logged-in owner', () => {
    expect(resolveInspectionDocumentPolicy({ authorId: null, actorId: 'owner', mediaPending: 0, mediaKnown: true }).canSignAsAuthor).toBe(false);
  });
  it('author can sign but pending photos keep the report preliminary', () => {
    expect(resolveInspectionDocumentPolicy({ authorId: 'pedro', actorId: 'pedro', mediaPending: 2, mediaKnown: true }))
      .toEqual({ canSignAsAuthor: true, documentStatus: 'preliminary' });
  });
  it('unknown media completeness never certifies final evidence', () => {
    expect(resolveInspectionDocumentPolicy({ authorId: 'pedro', actorId: 'pedro', mediaPending: null, mediaKnown: false }).documentStatus).toBe('preliminary');
  });
  it('same author with known complete media may emit final', () => {
    expect(resolveInspectionDocumentPolicy({ authorId: 'pedro', actorId: 'pedro', mediaPending: 0, mediaKnown: true }).documentStatus).toBe('final');
  });
  it('a recorded evidence waiver permits the author to finalize but never grants authorship', () => {
    expect(resolveInspectionDocumentPolicy({ authorId: 'pedro', actorId: 'pedro', mediaPending: 2, mediaKnown: true, mediaWaived: true }).documentStatus).toBe('final');
    expect(resolveInspectionDocumentPolicy({ authorId: 'pedro', actorId: 'owner', mediaPending: 2, mediaKnown: true, mediaWaived: true }).documentStatus).toBe('preliminary');
  });
});
