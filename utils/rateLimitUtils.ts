import { supabase } from './supabase';

export type RateLimitAction = 'gerar_pdf' | 'criar_vistoria';

const LIMITS: Record<RateLimitAction, { max: number; windowSeconds: number; msg: string }> = {
  gerar_pdf:      { max: 10, windowSeconds: 3600,  msg: 'Limite de 10 PDFs por hora atingido. Tente novamente mais tarde.' },
  criar_vistoria: { max: 30, windowSeconds: 86400, msg: 'Limite de 30 vistorias por dia atingido.' },
};

export async function checkRateLimit(
  uid: string,
  action: RateLimitAction
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const limit = LIMITS[action];
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_uid: uid,
      p_action: action,
      p_max_count: limit.max,
      p_window_seconds: limit.windowSeconds,
    });

    if (error) return { allowed: true }; // fail-open: não bloquear se RPC falhar
    return data === true ? { allowed: true } : { allowed: false, message: limit.msg };
  } catch {
    return { allowed: true }; // fail-open
  }
}
