import type { SupabaseClient } from '@supabase/supabase-js';

type LocalEvidence = { foto_url: string | null; fotos_urls: string | null; sincronizado: number };
export type InspectionEvidence = { primary: string | null; extras: string[] };

/** Offline cache follows the actor's established scope; it is not global to a shared phone. */
export function canReadCachedInspection(
  actor: { uid: string; role: string; municipio?: string | null } | null | undefined,
  record: { agente_uid: string; municipio?: string | null },
): boolean {
  if (!actor?.uid) return false;
  if (actor.role === 'owner' || actor.role === 'master_admin') return true;
  if (record.agente_uid === actor.uid) return true;
  return ['admin', 'supervisor'].includes(actor.role) && Boolean(actor.municipio?.trim()) && actor.municipio === record.municipio;
}

function cachedEvidence(local: LocalEvidence): InspectionEvidence {
  let extras: string[] = [];
  try {
    const parsed = JSON.parse(local.fotos_urls || '[]');
    if (Array.isArray(parsed)) extras = parsed.filter((value): value is string => typeof value === 'string');
  } catch { /* The primary photo remains usable in a legacy malformed cache. */ }
  return { primary: local.foto_url, extras };
}

/** A pending local capture wins; a synchronized cache must not hide later server changes. */
export async function loadInspectionEvidence(
  client: SupabaseClient,
  inspectionId: string,
  local: LocalEvidence | null,
  training = false,
): Promise<InspectionEvidence | null> {
  if (training || local?.sincronizado === 0) return local ? cachedEvidence(local) : null;
  try {
    const { data, error } = await client.from('vistorias').select('fotoUrl,fotosUrls').eq('id', inspectionId).single();
    if (error) throw error;
    if (!data) return local ? cachedEvidence(local) : null;
    return { primary: data.fotoUrl ?? null, extras: Array.isArray(data.fotosUrls) ? data.fotosUrls : [] };
  } catch (error) {
    if (local) return cachedEvidence(local);
    throw error;
  }
}
