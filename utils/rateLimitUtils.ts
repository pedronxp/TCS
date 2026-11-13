import { supabase } from './supabase';

export type RateLimitAction = 'gerar_pdf' | 'criar_vistoria';

const LIMITS: Record<RateLimitAction, { max: number; windowSeconds: number; msg: string }> = {
  gerar_pdf:      { max: 10, windowSeconds: 3600,  msg: 'Limite de 10 PDFs por hora atingido. Tente novamente mais tarde.' },
  criar_vistoria: { max: 30, windowSeconds: 86400, msg: 'Limite de 30 vistorias por dia atingido.' },
};

export async function checkRateLimit(
  action: RateLimitAction,
  options?: { offline?: boolean }
): Promise<{ allowed: boolean; message?: string; reason?: 'limit' | 'unavailable' | 'deferred' }> {
  if (options?.offline) return { allowed: true, reason: 'deferred' };
  const unavailable = { allowed: false, reason: 'unavailable' as const, message: 'Não foi possível verificar o limite no servidor. Tente novamente quando a conexão estiver disponível.' };
  try {
    const limit = LIMITS[action];
    const { data, error } = await supabase.rpc('enforce_my_operational_rate_limit', { p_action: action });

    if (error || typeof data !== 'boolean') return unavailable;
    return data === true ? { allowed: true } : { allowed: false, reason: 'limit', message: limit.msg };
  } catch {
    return unavailable;
  }
}
