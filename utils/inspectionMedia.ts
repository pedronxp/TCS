/** Shared wire contract: local file names never leave the collecting device. */
export type InspectionMediaItem = { id: string; position: number; state: 'available' | 'pending' | 'failed' | 'removed'; storagePath: string | null };
export type InspectionMediaManifest = { version: 1; revision: number; base_revision?: number | null; expected: number; available: number; items: InspectionMediaItem[] };
export type InspectionMediaStatus = { expected_count: number | null; available_count: number; pending_count: number | null; complete: boolean; revision: number | null };

export const isLocalInspectionMedia = (value: unknown): value is string => typeof value === 'string' && /^(file|content|ph|assets-library):/i.test(value);

export function buildInspectionMediaManifest(inspectionId: string, primary: string | null | undefined, extras: readonly string[] = [], revision = Date.now(), identities?: readonly string[]): InspectionMediaManifest {
  const paths = [...new Set([primary, ...extras].filter((p): p is string => typeof p === 'string' && Boolean(p)))];
  if (paths.length > 3) throw new Error('Máximo de 3 fotos por vistoria.');
  const items = paths.map((path, position): InspectionMediaItem => ({
    id: identities?.[position] ?? `${inspectionId}:photo:${position}`, position,
    state: isLocalInspectionMedia(path) ? 'pending' : 'available',
    storagePath: isLocalInspectionMedia(path) ? null : path,
  }));
  return { version: 1, revision, expected: items.length, available: items.filter(i => i.state === 'available').length, items };
}

export function assessInspectionMedia(manifest: unknown, availableFallback = 0): InspectionMediaStatus {
  const value = manifest && typeof manifest === 'object' ? manifest as Partial<InspectionMediaManifest> : null;
  if (value?.version !== 1 || !Number.isInteger(value.expected) || !Array.isArray(value.items)) {
    return { expected_count: null, available_count: Math.max(0, availableFallback), pending_count: null, complete: false, revision: null };
  }
  const available = value.items.filter(i => i.state === 'available' && i.storagePath && !isLocalInspectionMedia(i.storagePath)).length;
  const expected = value.items.filter(i => i.state !== 'removed').length;
  return { expected_count: expected, available_count: available, pending_count: Math.max(0, expected - available), complete: available === expected, revision: value.revision ?? null };
}

export function stripLocalMediaReferences(value: unknown): unknown {
  if (isLocalInspectionMedia(value)) return null;
  if (typeof value === 'string' && /^\s*[\[{]/.test(value)) {
    try { return JSON.stringify(stripLocalMediaReferences(JSON.parse(value))); } catch { return value; }
  }
  if (Array.isArray(value)) return value.map(stripLocalMediaReferences);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripLocalMediaReferences(v)]));
  return value;
}
