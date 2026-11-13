import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildInspectionMediaManifest, type InspectionMediaManifest } from '../utils/inspectionMedia';
import { generateUUID } from '../utils/uuid';

type MediaRecord = { id: string; agente_uid: string; foto_url: string | null; fotos_urls: string | null };
type CachedMedia = { revision: number; base_revision?: number | null; paths: string[]; identities?: string[] };

function paths(v: MediaRecord): string[] {
  let extras: string[] = [];
  try { const parsed = JSON.parse(v.fotos_urls || '[]'); if (Array.isArray(parsed)) extras = parsed.filter((p): p is string => typeof p === 'string'); } catch { /* legacy malformed extras do not discard the primary */ }
  return [...new Set([v.foto_url, ...extras].filter((p): p is string => Boolean(p)))];
}
const cacheKey = (v: MediaRecord) => `tcs:inspection-media:${v.agente_uid}:${v.id}`;

/** Persist revision before sending: stale offline retries cannot undo a newer removal. */
export async function prepareInspectionMedia(v: MediaRecord): Promise<InspectionMediaManifest> {
  const current = paths(v);
  let cached: CachedMedia | null = null;
  try { const raw = await AsyncStorage.getItem(cacheKey(v)); cached = raw ? JSON.parse(raw) : null; } catch { /* a damaged cache needs a new revision */ }
  const unchanged = cached && Number.isSafeInteger(cached.revision) && JSON.stringify(cached.paths) === JSON.stringify(current);
  const revision = unchanged && cached ? cached.revision : Math.max(Date.now(), (cached?.revision ?? 0) + 1);
  const identities = current.map(path => {
    const previousIndex = cached?.paths?.indexOf(path) ?? -1;
    return previousIndex >= 0 && cached?.identities?.[previousIndex] ? cached.identities[previousIndex] : `${v.id}:photo:${generateUUID()}`;
  });
  const base_revision = unchanged ? cached?.base_revision ?? null : cached?.revision ?? null;
  await AsyncStorage.setItem(cacheKey(v), JSON.stringify({ revision, base_revision, paths: current, identities }));
  return { ...buildInspectionMediaManifest(v.id, current[0], current.slice(1), revision, identities), base_revision };
}

/** Upload only changes availability, never the identity/revision of a capture. */
export async function finishInspectionMedia(v: MediaRecord, previous: InspectionMediaManifest): Promise<InspectionMediaManifest> {
  const current = paths(v);
  const identities = previous.items.map(item => item.id);
  await AsyncStorage.setItem(cacheKey(v), JSON.stringify({ revision: previous.revision, base_revision: previous.base_revision ?? null, paths: current, identities }));
  return { ...buildInspectionMediaManifest(v.id, current[0], current.slice(1), previous.revision, identities), base_revision: previous.base_revision ?? null };
}
