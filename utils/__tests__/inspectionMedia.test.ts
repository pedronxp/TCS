import { buildInspectionMediaManifest, assessInspectionMedia, stripLocalMediaReferences } from '../inspectionMedia';

describe('inspection media completeness', () => {
  it('counts pending media without transmitting local filenames', () => {
    const result = buildInspectionMediaManifest('inspection-1', 'file:///private/photo.jpg', ['fotos:agent/one.jpg'], 12);
    expect(result.expected).toBe(2);
    expect(result.available).toBe(1);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(result.items[0]).toMatchObject({ id: 'inspection-1:photo:0', state: 'pending', storagePath: null });
  });
  it('keeps identity across uploads and rejects more than three unique images', () => {
    const before = buildInspectionMediaManifest('i', 'file:///a', [], 10);
    const after = buildInspectionMediaManifest('i', 'fotos:user/a.jpg', [], 10);
    expect(before.items[0].id).toBe(after.items[0].id);
    expect(() => buildInspectionMediaManifest('i', 'fotos:a', ['fotos:b', 'fotos:c', 'fotos:d'], 10)).toThrow('Máximo');
  });
  it('distinguishes legacy unknown from explicitly empty and partial', () => {
    expect(assessInspectionMedia(null, 1)).toMatchObject({ expected_count: null, available_count: 1, pending_count: null, complete: false });
    expect(assessInspectionMedia(buildInspectionMediaManifest('i', null, [], 1), 0).complete).toBe(true);
    expect(assessInspectionMedia(buildInspectionMediaManifest('i', 'file:///a', [], 1), 0).pending_count).toBe(1);
  });
  it('strips private local references recursively from answer snapshots', () => {
    expect(stripLocalMediaReferences({ photo: 'file:///a', nested: ['content://camera/a', 'yes'] })).toEqual({ photo: null, nested: [null, 'yes'] });
    expect(stripLocalMediaReferences({ photos: '["file:///a","fotos:a"]' })).toEqual({ photos: '[null,"fotos:a"]' });
  });
});
