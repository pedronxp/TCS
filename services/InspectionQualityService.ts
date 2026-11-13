import type { SupabaseClient } from '@supabase/supabase-js';

export interface InspectionQualitySummary {
  status: 'pendente' | 'aprovada' | 'devolvida';
  ciclo: number;
  nota: number | null;
  parecer: string | null;
}

/** Navigation only. The review RPC enforces the actor's authorization. */
export function canReviewInspectionQuality(role: string | null | undefined): boolean {
  return ['owner', 'supervisor', 'admin', 'master_admin'].includes(role ?? '');
}

export async function fetchInspectionQuality(
  client: SupabaseClient,
  inspectionId: string,
): Promise<InspectionQualitySummary | null> {
  const { data, error } = await client.rpc('qe_status_vistoria', { p_vistoria_id: inspectionId });
  if (error) throw new Error(error.message || 'Não foi possível consultar a revisão.');
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  if (!['pendente', 'aprovada', 'devolvida'].includes(row?.status)) {
    throw new Error('O servidor retornou um estado de revisão desconhecido.');
  }
  return row as InspectionQualitySummary;
}
