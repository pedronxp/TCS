import { useQuery } from '@tanstack/react-query';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';

export type TokenStatus = 'active' | 'used' | 'expired' | 'revoked';
export type TokenAnalytics = {
  summary: { total: number; active: number; used: number; expired: number; revoked: number; createdLast7Days: number; creatorCount: number };
  daily: Array<{ date: string; count: number }>;
  creators: Array<{ name: string; total: number; active: number; used: number }>;
  roles: Array<{ role: string; count: number }>;
  items: Array<{ managementId: string; role: string; municipio: string; createdAt: string; expiresAt: string | null; used: boolean; revokedAt: string | null; status: TokenStatus; createdByName: string }>;
};

function status(value: unknown): TokenStatus {
  return value === 'used' || value === 'expired' || value === 'revoked' ? value : 'active';
}

export function parseTokenAnalytics(value: import('@/types/supabase').Json | null): TokenAnalytics {
  const root = jsonObject(value);
  const summary = jsonObject(root?.summary);
  return {
    summary: {
      total: jsonNumber(summary?.total) || 0,
      active: jsonNumber(summary?.active) || 0,
      used: jsonNumber(summary?.used) || 0,
      expired: jsonNumber(summary?.expired) || 0,
      revoked: jsonNumber(summary?.revoked) || 0,
      createdLast7Days: jsonNumber(summary?.created_last_7_days) || 0,
      creatorCount: jsonNumber(summary?.creator_count) || 0,
    },
    daily: jsonArray(root?.daily).map(jsonObject).filter(Boolean).map((item) => ({ date: jsonString(item?.date) || '', count: jsonNumber(item?.count) || 0 })),
    creators: jsonArray(root?.creators).map(jsonObject).filter(Boolean).map((item) => ({ name: jsonString(item?.name) || 'Emissor não informado', total: jsonNumber(item?.total) || 0, active: jsonNumber(item?.active) || 0, used: jsonNumber(item?.used) || 0 })),
    roles: jsonArray(root?.roles).map(jsonObject).filter(Boolean).map((item) => ({ role: jsonString(item?.role) || 'Não informado', count: jsonNumber(item?.count) || 0 })),
    items: jsonArray(root?.items).map(jsonObject).filter(Boolean).flatMap((item) => {
      const managementId = jsonString(item?.management_id);
      const createdAt = jsonString(item?.created_at);
      if (!managementId || !createdAt) return [];
      return [{ managementId, role: jsonString(item?.role) || 'agent', municipio: jsonString(item?.municipio) || 'Não informado', createdAt, expiresAt: jsonString(item?.expires_at), used: item?.used === true, revokedAt: jsonString(item?.revoked_at), status: status(item?.status), createdByName: jsonString(item?.created_by_name) || 'Emissor não informado' }];
    }),
  };
}

export function useTokenAnalytics(municipio: string, uf: string) {
  return useQuery({
    queryKey: ['console-token-analytics', municipio, uf],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: import('@/types/supabase').Json | null; error: Error | null }>)('get_internal_token_analytics', {
        p_municipio: municipio.trim() || null,
        p_uf: uf.trim() || null,
      });
      if (error) throw error;
      return parseTokenAnalytics(data);
    },
  });
}
