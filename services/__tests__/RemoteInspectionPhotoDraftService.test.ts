import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../utils/supabase';
import { uploadImageFromLocalUri } from '../StorageService';
import { getRemoteInspectionPhotoDraft, saveRemoteInspectionPhotoDraft, syncPendingRemotePhotoDrafts } from '../RemoteInspectionPhotoDraftService';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../utils/supabase', () => ({ supabase: { rpc: jest.fn(async () => ({ error: null })), auth: { getSession: jest.fn(async () => ({ data: { session: { user: { id: 'owner' } } } })) } } }));
jest.mock('../StorageService', () => ({ uploadImageFromLocalUri: jest.fn() }));

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

it('isolates drafts by the authenticated actor', async () => {
  await saveRemoteInspectionPhotoDraft('pedro', 'inspection', ['file://a.jpg'], 1);
  expect(await getRemoteInspectionPhotoDraft('owner', 'inspection')).toBeNull();
  expect(await syncPendingRemotePhotoDrafts('owner')).toEqual({ success: 0, failed: 0, conflicts: 0 });
  expect(uploadImageFromLocalUri).not.toHaveBeenCalled();
});

it('does not publish a capture draft before the user saves its evidence changes', async () => {
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg'], 1, null, false);
  expect(await syncPendingRemotePhotoDrafts('owner')).toEqual({ success: 0, failed: 0, conflicts: 0 });
  expect(uploadImageFromLocalUri).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});

it('uses a monotonic edit revision even when two changes share the same clock tick', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(100);
  const first = await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg']);
  const removed = await saveRemoteInspectionPhotoDraft('owner', 'inspection', []);
  expect(removed.revision).toBeGreaterThan(first.revision);
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg'], first.revision);
  expect((await getRemoteInspectionPhotoDraft('owner', 'inspection'))?.paths).toEqual([]);
  clock.mockRestore();
});

it('does not upload or publish another account draft after the session changes', async () => {
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg'], 1);
  (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: { user: { id: 'other' } } } });
  await syncPendingRemotePhotoDrafts('owner');
  expect(uploadImageFromLocalUri).not.toHaveBeenCalled();
  expect(supabase.rpc).not.toHaveBeenCalled();
});

it('checks the active account again after an upload and before publishing metadata', async () => {
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg'], 1);
  (uploadImageFromLocalUri as jest.Mock).mockImplementationOnce(async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({ data: { session: { user: { id: 'other' } } } });
    return 'fotos:a';
  });
  await syncPendingRemotePhotoDrafts('owner');
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect(await getRemoteInspectionPhotoDraft('owner', 'inspection')).not.toBeNull();
});

it('publishes partial availability and retries only the missing photo using the correct inspection id', async () => {
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg', 'file://b.jpg'], 10);
  (uploadImageFromLocalUri as jest.Mock).mockResolvedValueOnce('fotos:a').mockRejectedValueOnce(new Error('offline'));
  expect(await syncPendingRemotePhotoDrafts('owner')).toEqual({ success: 0, failed: 1, conflicts: 0 });
  expect(uploadImageFromLocalUri).toHaveBeenCalledWith('file://a.jpg', 'inspection');
  const first = (supabase.rpc as jest.Mock).mock.calls[0][1];
  expect(first.p_media_manifest).toMatchObject({ expected: 2, available: 1, revision: 10 });
  expect(JSON.stringify(first)).not.toContain('file://');
  expect((await getRemoteInspectionPhotoDraft('owner', 'inspection'))?.paths).toEqual(['fotos:a', 'file://b.jpg']);
  (uploadImageFromLocalUri as jest.Mock).mockClear().mockResolvedValueOnce('fotos:b');
  expect(await syncPendingRemotePhotoDrafts('owner')).toEqual({ success: 1, failed: 0, conflicts: 0 });
  expect(uploadImageFromLocalUri).toHaveBeenCalledTimes(1);
  expect(uploadImageFromLocalUri).toHaveBeenCalledWith('file://b.jpg', 'inspection');
  const second = (supabase.rpc as jest.Mock).mock.calls[1][1];
  expect(second.p_media_manifest.items.map((item: { id: string }) => item.id)).toEqual(first.p_media_manifest.items.map((item: { id: string }) => item.id));
  expect(await getRemoteInspectionPhotoDraft('owner', 'inspection')).toBeNull();
});

it('does not resurrect removed evidence when an earlier upload finishes', async () => {
  let complete!: (value: string) => void;
  (uploadImageFromLocalUri as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg'], 10);
  const pending = syncPendingRemotePhotoDrafts('owner');
  for (let i = 0; i < 10 && !complete; i++) await Promise.resolve();
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', [], 11);
  complete('fotos:a');
  await pending;
  expect(supabase.rpc).not.toHaveBeenCalled();
  expect((await getRemoteInspectionPhotoDraft('owner', 'inspection'))?.paths).toEqual([]);
  expect((await getRemoteInspectionPhotoDraft('owner', 'inspection'))?.revision).toBe(11);
});

it('preserves a server revision conflict for explicit resolution without repeated automatic overwrite', async () => {
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['fotos:a'], 10);
  (supabase.rpc as jest.Mock).mockResolvedValueOnce({ error: { message: 'media_revision_conflict' } });
  expect(await syncPendingRemotePhotoDrafts('owner')).toEqual({ success: 0, failed: 0, conflicts: 1 });
  expect((await getRemoteInspectionPhotoDraft('owner', 'inspection'))?.error).toBe('media_revision_conflict');
  await syncPendingRemotePhotoDrafts('owner');
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

it('keeps expected slots owned by another phone when background retry completes this phones attachment', async () => {
  const pending = [
    { id: 'remote-b', position: 1, state: 'pending' as const, storagePath: null },
    { id: 'remote-c', position: 2, state: 'pending' as const, storagePath: null },
  ];
  await saveRemoteInspectionPhotoDraft('owner', 'inspection', ['file://a.jpg'], 20, 10, true, ['own-a'], pending, ['own-a', 'remote-b', 'remote-c']);
  (uploadImageFromLocalUri as jest.Mock).mockResolvedValueOnce('fotos:a');
  await syncPendingRemotePhotoDrafts('owner');
  const published = (supabase.rpc as jest.Mock).mock.calls[0][1].p_media_manifest;
  expect(published).toMatchObject({ expected: 3, available: 1, base_revision: 10 });
  expect(published.items.map((item: { id: string }) => item.id)).toEqual(['own-a', 'remote-b', 'remote-c']);
});
