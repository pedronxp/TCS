import { collectInspectionPhotos, decodePhotoAnswer, encodePhotoAnswer, changePhotoAnswer, createCaptureGate } from '../inspectionPhotos';

describe('inspection photos', () => {
  it('reads legacy scalar, new arrays, and encoded draft answers without treating JSON as a path', () => {
    expect(decodePhotoAnswer('file://old.jpg')).toEqual(['file://old.jpg']);
    expect(decodePhotoAnswer('["file://a.jpg","file://b.jpg"]')).toEqual(['file://a.jpg', 'file://b.jpg']);
    expect(decodePhotoAnswer(['file://a.jpg', '', 'file://a.jpg'])).toEqual(['file://a.jpg']);
    expect(decodePhotoAnswer('[broken')).toEqual([]);
    expect(decodePhotoAnswer(null)).toEqual([]);
  });
  it('keeps a scalar for one image and round trips multiple images and empty drafts', () => {
    expect(encodePhotoAnswer(['a'])).toBe('a');
    expect(decodePhotoAnswer(encodePhotoAnswer(['a', 'b']))).toEqual(['a', 'b']);
    expect(encodePhotoAnswer([])).toBe('');
  });
  it('flattens and deduplicates photos in question order', () => {
    expect(collectInspectionPhotos(['a', '["b","a"]', ['c']])).toEqual(['a', 'b', 'c']);
  });
  it('rejects a fourth image across questions without silently truncating data', () => {
    expect(() => changePhotoAnswer(['a', 'b'], 'c', undefined, ['d'])).toThrow('Máximo de 3 fotos');
    expect(changePhotoAnswer(['a', 'b'], 'c', 0, ['d'])).toEqual(['c', 'b']);
  });
  it('canceling capture keeps images unchanged and replacement preserves order', () => {
    expect(changePhotoAnswer(['a', 'b'], null)).toEqual(['a', 'b']);
    expect(changePhotoAnswer(['a', 'b'], 'c', 1)).toEqual(['a', 'c']);
    expect(changePhotoAnswer(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });
  it('permits only one capture until released', () => {
    const gate = createCaptureGate();
    expect(gate.enter()).toBe(true);
    expect(gate.enter()).toBe(false);
    gate.release();
    expect(gate.enter()).toBe(true);
  });
});
