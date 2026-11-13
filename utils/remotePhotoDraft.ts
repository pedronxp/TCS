import type { InspectionMediaItem, InspectionMediaManifest } from './inspectionMedia';

/** A draft can retry its own revision, or edit its original base; never rebase silently. */
export function remotePhotoDraftConflicts(draft: { revision: number; baseRevision?: number | null }, serverRevision: number | null, serverKnown: boolean): boolean {
  if (!serverKnown || serverRevision === draft.revision) return false;
  return draft.baseRevision === undefined || draft.baseRevision !== serverRevision;
}

/** Preserve slots whose files still live on another phone when editing available evidence. */
export function preservePendingPhotoSlots(manifest: InspectionMediaManifest, pending: readonly InspectionMediaItem[], originalOrder: readonly string[] = []): InspectionMediaManifest {
  const present = new Set(manifest.items.map(item => item.id));
  const pendingOnly = pending.filter(item => item.state !== 'available' && item.state !== 'removed' && !present.has(item.id));
  const items = [...manifest.items, ...pendingOnly.map(item => ({ ...item, storagePath: null }))];
  if (items.length > 3) throw new Error('Máximo de 3 fotos por vistoria, incluindo evidências pendentes de outro aparelho.');
  const order = (id: string) => { const index = originalOrder.indexOf(id); return index < 0 ? originalOrder.length + manifest.items.findIndex(item => item.id === id) : index; };
  items.sort((a, b) => order(a.id) - order(b.id));
  return { ...manifest, expected: items.length, available: items.filter(item => item.state === 'available' && item.storagePath).length, items: items.map((item, position) => ({ ...item, position })) };
}
