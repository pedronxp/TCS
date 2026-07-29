import { supabase } from '../utils/supabase';

export interface GeneratedInspectionLaudo {
  ok: boolean;
  reused: boolean;
  document_status: 'available';
  signed_url: string;
  expires_in: number;
  generated_at?: string;
}

/**
 * Garante que uma vistoria concluída tenha um PDF persistido no Storage.
 * A Edge Function valida no servidor se o usuário pode acessar a vistoria;
 * nenhum dado de autorização enviado pelo cliente é considerado confiável.
 */
export async function ensureInspectionLaudo(
  inspectionId: string,
  options: { customerId?: string; force?: boolean } = {},
): Promise<GeneratedInspectionLaudo> {
  const { data, error } = await supabase.functions.invoke('generate-inspection-laudo', {
    body: {
      inspection_id: inspectionId,
      customer_id: options.customerId,
      force: options.force === true,
    },
  });

  if (error || !data?.ok || !data?.signed_url) {
    throw new Error(data?.error || error?.message || 'document_generation_failed');
  }
  return data as GeneratedInspectionLaudo;
}
