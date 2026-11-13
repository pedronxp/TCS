import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { buildInspectionMediaManifest, isLocalInspectionMedia, type InspectionMediaManifest, type InspectionMediaItem } from '../utils/inspectionMedia';
import { preservePendingPhotoSlots } from '../utils/remotePhotoDraft';
import { uploadImageFromLocalUri } from './StorageService';

export type RemoteInspectionPhotoDraft = {
  actorUid: string; inspectionId: string; paths: string[]; revision: number;
  baseRevision?: number | null; error?: string; ready?: boolean; identities?: string[];
  pendingItems?: InspectionMediaItem[]; remoteOrder?: string[];
};
const key = (actor: string, inspection: string) => `@inspection_photo_draft:${actor}:${inspection}`;
const writes = new Map<string, Promise<unknown>>();
const running = new Map<string, Promise<{ success: number; failed: number; conflicts: number }>>();
async function serialized<T>(storageKey: string, action: () => Promise<T>): Promise<T> {
  const pending = (writes.get(storageKey) ?? Promise.resolve()).catch(() => undefined).then(action);
  writes.set(storageKey, pending);
  try { return await pending; } finally { if (writes.get(storageKey) === pending) writes.delete(storageKey); }
}

export async function getRemoteInspectionPhotoDraft(actorUid: string, inspectionId: string): Promise<RemoteInspectionPhotoDraft | null> {
  const raw = await AsyncStorage.getItem(key(actorUid, inspectionId));
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (!Array.isArray(draft.paths) || draft.paths.some((p: unknown) => typeof p !== 'string')) return null;
    if (draft.actorUid && draft.actorUid !== actorUid) return null;
    if (draft.inspectionId && draft.inspectionId !== inspectionId) return null;
    return { ...draft, actorUid, inspectionId, revision: Number.isSafeInteger(draft.revision) ? draft.revision : 1 };
  } catch { return null; }
}

export async function saveRemoteInspectionPhotoDraft(actorUid: string, inspectionId: string, paths: string[], revision?: number, baseRevision?: number | null, ready = true, identities?: string[], pendingItems: InspectionMediaItem[] = [], remoteOrder: string[] = []): Promise<RemoteInspectionPhotoDraft> {
  if (!actorUid || !inspectionId) throw new Error('Conta e vistoria necessárias para preservar fotos.');
  const unique = [...new Set(paths)];
  if (unique.length + pendingItems.length > 3) throw new Error('Máximo de 3 fotos por vistoria.');
  return serialized(key(actorUid, inspectionId), async () => {
    const prior = await getRemoteInspectionPhotoDraft(actorUid, inspectionId);
    if (revision !== undefined && prior && prior.revision > revision) return prior;
    const nextRevision = revision ?? Math.max(Date.now(), (prior?.revision ?? 0) + 1);
    const stableIds = identities ?? unique.map((path, index) => {
      const oldIndex = prior?.paths.indexOf(path) ?? -1;
      return (oldIndex >= 0 ? prior?.identities?.[oldIndex] : undefined)
        ?? (prior?.revision === nextRevision ? prior.identities?.[index] : undefined)
        ?? `${inspectionId}:photo:${nextRevision}:${index}`;
    });
    const draft = { actorUid, inspectionId, paths: unique, revision: nextRevision, baseRevision, ready, identities: stableIds, pendingItems, remoteOrder };
    await AsyncStorage.setItem(key(actorUid, inspectionId), JSON.stringify(draft));
    return draft;
  });
}

export async function removeRemoteInspectionPhotoDraft(actorUid: string, inspectionId: string, revision?: number): Promise<void> {
  await serialized(key(actorUid, inspectionId), async () => {
    const draft = await getRemoteInspectionPhotoDraft(actorUid, inspectionId);
    if (revision === undefined || draft?.revision === revision) await AsyncStorage.removeItem(key(actorUid, inspectionId));
  });
}

async function updateCurrent(draft: RemoteInspectionPhotoDraft, changes: Partial<RemoteInspectionPhotoDraft>): Promise<boolean> {
  return serialized(key(draft.actorUid, draft.inspectionId), async () => {
    const now = await getRemoteInspectionPhotoDraft(draft.actorUid, draft.inspectionId);
    if (!now || now.revision !== draft.revision || now.ready === false) return false;
    await AsyncStorage.setItem(key(draft.actorUid, draft.inspectionId), JSON.stringify({ ...now, ...changes }));
    return true;
  });
}

/** Also handles attachments captured on a phone that has no local inspection row. */
export async function syncPendingRemotePhotoDrafts(actorUid: string): Promise<{ success: number; failed: number; conflicts: number }> {
  if (running.has(actorUid)) return running.get(actorUid)!;
  const task = (async () => {
    const result = { success: 0, failed: 0, conflicts: 0 };
    const isCurrentActor = async () => {
      try { const { data } = await supabase.auth.getSession(); return data.session?.user.id === actorUid; }
      catch { return false; }
    };
    if (!actorUid || !(await isCurrentActor())) return result;
    const prefix = `@inspection_photo_draft:${actorUid}:`;
    const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(prefix));
    for (const storageKey of keys) {
      const draft = await getRemoteInspectionPhotoDraft(actorUid, storageKey.slice(prefix.length));
      if (!draft || draft.ready === false || draft.error === 'media_revision_conflict') continue;
      const paths = [...draft.paths];
      let superseded = false;
      for (let i = 0; i < paths.length; i++) {
        if (!isLocalInspectionMedia(paths[i])) continue;
        try {
          paths[i] = await uploadImageFromLocalUri(paths[i], draft.inspectionId);
          if (!(await updateCurrent(draft, { paths: [...paths] }))) { superseded = true; break; }
        } catch { /* Keep the original URI: next retry sends only missing slots. */ }
      }
      if (superseded) continue;
      const current = await getRemoteInspectionPhotoDraft(actorUid, draft.inspectionId);
      if (!current || current.revision !== draft.revision || current.ready === false) continue;
      const manifest: InspectionMediaManifest = preservePendingPhotoSlots(buildInspectionMediaManifest(draft.inspectionId, paths[0], paths.slice(1), draft.revision, draft.identities), draft.pendingItems ?? [], draft.remoteOrder);
      if (draft.baseRevision !== undefined) (manifest as InspectionMediaManifest & { base_revision?: number | null }).base_revision = draft.baseRevision;
      const available = paths.filter(p => !isLocalInspectionMedia(p));
      if (!(await isCurrentActor())) return result;
      try {
        const { error } = await supabase.rpc('update_inspection_media', {
          p_inspection_id: draft.inspectionId, p_primary_photo: available[0] ?? null,
          p_extra_photos: available.slice(1), p_media_manifest: manifest,
        });
        if (error) {
          const conflict = error.message?.includes('media_revision_conflict');
          await updateCurrent(draft, { paths, error: conflict ? 'media_revision_conflict' : error.message });
          if (conflict) result.conflicts++; else result.failed++;
        } else if (paths.some(isLocalInspectionMedia)) {
          await updateCurrent(draft, { paths, error: 'media_upload_pending' }); result.failed++;
        } else { await removeRemoteInspectionPhotoDraft(actorUid, draft.inspectionId, draft.revision); result.success++; }
      } catch { result.failed++; }
    }
    return result;
  })();
  running.set(actorUid, task);
  try { return await task; } finally { if (running.get(actorUid) === task) running.delete(actorUid); }
}
