import { canonicalInspectionSnapshot, inspectionPhotoSources, resolveInspectionIssuance } from '../../supabase/functions/_shared/inspectionIssuance';
describe('document issuance', () => {
  const media = { expected_count: 3, available_count: 1, pending_count: 2 };
  const signature = [{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }];
  it('allows a preliminary report without waiting for the original agent or images', () => {
    expect(resolveInspectionIssuance({ requested: 'preliminary', actorId: 'owner', agentId: 'pedro', media, signature: null })).toBe('preliminary');
  });
  it('does not let owner sign as Pedro or issue final without evidence or actual signature', () => {
    expect(() => resolveInspectionIssuance({ requested: 'final', actorId: 'owner', agentId: 'pedro', media, signature })).toThrow('technical_responsibility');
    expect(() => resolveInspectionIssuance({ requested: 'final', actorId: 'pedro', agentId: 'pedro', media, signature })).toThrow('evidence_pending');
    expect(resolveInspectionIssuance({ requested: 'final', actorId: 'pedro', agentId: 'pedro', media, signature, waiverReason: 'Motivo autorizado' })).toBe('final');
  });
  it.each([
    [{ points: [] }], [{ points: [null, null] }], [{ points: [{x:0,y:0},{x:0,y:0}] }],
    [{ points: [{x:0,y:0},{x:2,y:1}] }], [{ points: [{x:0,y:0},{x:NaN,y:1}] }],
  ])('rejects strokes that cannot render actual normalized signature ink: %j', stroke => {
    expect(() => resolveInspectionIssuance({ requested:'final', actorId:'pedro',agentId:'pedro',media:{expected_count:0,available_count:0,pending_count:0},signature:[stroke] })).toThrow('technical_signature_required');
  });
  it('preserves canonical snapshot order for cross-device integrity checks', () => {
    expect(canonicalInspectionSnapshot({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}');
  });
  it('includes and deduplicates the primary image alongside one or two extras', () => {
    expect(inspectionPhotoSources({fotoUrl:'a',fotosUrls:['b']})).toEqual(['a','b']);
    expect(inspectionPhotoSources({fotoUrl:'a',fotosUrls:['a','b','c']})).toEqual(['a','b','c']);
  });
});
