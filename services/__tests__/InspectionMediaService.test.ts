jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return { getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }), clear: async () => values.clear() };
});
import AsyncStorage from '@react-native-async-storage/async-storage';
import { prepareInspectionMedia, finishInspectionMedia } from '../InspectionMediaService';

describe('persisted inspection media identity', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  const record = { id: 'i', agente_uid: 'u', foto_url: 'file:///a', fotos_urls: '["file:///b"]' };
  it('preserves identity when upload changes URI and a preceding photo is removed', async () => {
    const pending = await prepareInspectionMedia(record);
    const uploaded = await finishInspectionMedia({ ...record, foto_url: 'fotos:u/a', fotos_urls: '["fotos:u/b"]' }, pending);
    expect(uploaded.items.map(i => i.id)).toEqual(pending.items.map(i => i.id));
    const removed = await prepareInspectionMedia({ ...record, foto_url: 'fotos:u/b', fotos_urls: '[]' });
    expect(removed.items[0].id).toBe(uploaded.items[1].id);
    expect(removed.revision).toBeGreaterThan(uploaded.revision);
  });
  it('replacement gets a fresh identity and retry preserves revision', async () => {
    const pending = await prepareInspectionMedia(record);
    const retried = await prepareInspectionMedia(record);
    expect(retried.revision).toBe(pending.revision);
    const replaced = await prepareInspectionMedia({ ...record, foto_url: 'file:///new' });
    expect(replaced.items[0].id).not.toBe(pending.items[0].id);
    expect(replaced.items[1].id).toBe(pending.items[1].id);
  });
});
