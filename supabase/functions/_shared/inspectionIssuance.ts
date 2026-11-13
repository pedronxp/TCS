export type IssuanceMedia = { expected_count: number | null; available_count: number; pending_count: number | null; complete?: boolean };
export function inspectionPhotoSources(inspection: Record<string, unknown>): string[] {
  const primary = inspection.fotoUrl ?? inspection.foto_url;
  const extras = inspection.fotosUrls ?? inspection.fotos_urls;
  return [...new Set([primary, ...(Array.isArray(extras) ? extras : [])].filter((p): p is string => typeof p === 'string' && p.length > 0))];
}

export function resolveInspectionIssuance(input: { requested: unknown; actorId: string; agentId: string | null; media: IssuanceMedia; signature: unknown; waiverReason?: string | null }): 'preliminary' | 'final' {
  if (input.requested !== 'final') return 'preliminary';
  if (input.actorId !== input.agentId) throw new Error('technical_responsibility_required');
  if (!hasRenderableTechnicalStrokes(input.signature)) throw new Error('technical_signature_required');
  if ((input.media.expected_count === null || input.media.pending_count !== 0) && !input.waiverReason) throw new Error('inspection_evidence_pending');
  return 'final';
}

export function hasRenderableTechnicalStrokes(strokes: unknown): boolean {
  if (!Array.isArray(strokes) || strokes.length === 0 || strokes.length > 80) return false;
  let hasInk = false;
  for (const stroke of strokes) {
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0 || stroke.points.length > 2000) return false;
    let first: {x:number;y:number} | null = null;
    for (const point of stroke.points) {
      if (!point || !['x','y'].every(k => typeof point[k] === 'number' && Number.isFinite(point[k]) && point[k] >= 0 && point[k] <= 1)) return false;
      if (first && (point.x !== first.x || point.y !== first.y)) hasInk = true;
      first ??= point;
    }
  }
  return hasInk;
}

/** JSON values only, same sorted-key canonical form as the mobile integrity helper. */
export function canonicalInspectionSnapshot(value: unknown): string {
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => [k, normalize(x)]));
    return typeof v === 'number' && !Number.isFinite(v) ? null : v;
  };
  return JSON.stringify(normalize(value));
}
