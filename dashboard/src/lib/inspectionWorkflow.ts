import type { InspectionMediaManifest, InspectionMediaStatus } from '../../../utils/inspectionMedia';

export function parseInspectionMediaStatus(value: unknown, fallback = 0): InspectionMediaStatus {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const expected = Number.isInteger(row.expected_count) && Number(row.expected_count) >= 0 ? Number(row.expected_count) : null;
  const available = Number.isInteger(row.available_count) ? Math.max(0, Number(row.available_count)) : Math.max(0, fallback);
  return { expected_count: expected, available_count: available, pending_count: expected === null ? null : Math.max(0, expected - available),
    complete: expected !== null && expected === available, revision: typeof row.revision === 'number' ? row.revision : null };
}

export function inspectionMediaLabel(status: InspectionMediaStatus): string {
  return status.expected_count === null ? `${status.available_count} foto(s) disponível(is) · quantidade esperada não informada`
    : `${status.available_count} de ${status.expected_count} fotos disponíveis${status.pending_count ? ` · ${status.pending_count} pendentes` : ''}`;
}

export function nextInspectionMediaManifest(inspectionId: string, previous: InspectionMediaManifest | null, legacyPaths: string[], uploadedPath: string | null, replaceId?: string): InspectionMediaManifest {
  const items = previous?.items.filter(i => i.state !== 'removed').map(i => ({ ...i })) ?? [...new Set(legacyPaths)].map((p, i) => ({ id: `${inspectionId}:legacy:${i}`, position: i, state: 'available' as const, storagePath: p }));
  const index = replaceId ? items.findIndex(i => i.id === replaceId) : -1;
  if (replaceId && index < 0) throw new Error('A foto foi alterada; atualize a vistoria.');
  if (index >= 0) items.splice(index, 1);
  if (uploadedPath) {
    const entry = { id: `${inspectionId}:photo:${crypto.randomUUID()}`, position: index >= 0 ? index : items.length, state: 'available' as const, storagePath: uploadedPath };
    if (index >= 0) items.splice(index, 0, entry); else items.push(entry);
  }
  if (items.length > 3) throw new Error('Máximo de 3 fotos por vistoria.');
  return { version: 1, revision: Math.max(Date.now(), (previous?.revision ?? 0) + 1), base_revision: previous?.revision ?? null,
    expected: items.length, available: items.filter(i => i.state === 'available').length, items: items.map((i, position) => ({ ...i, position })) };
}
