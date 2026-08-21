import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type TokenRecord = {
  managementId: string;
  role: string;
  municipio: string | null;
  usado: boolean;
  criadoEm: string;
  expiresAt: string | null;
  status: 'active' | 'used' | 'expired' | 'revoked';
};

type TokenRpcRow = {
  management_id: string;
  role: string;
  municipio: string | null;
  created_at: string;
  expires_at: string | null;
  used: boolean;
  status: TokenRecord['status'];
};

export function useTokens() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['tokens', profile?.role, profile?.municipio],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: TokenRpcRow[] | null; error: { message: string } | null }>)('list_console_invite_tokens', {
        p_municipio: profile?.role === 'master_admin' ? null : profile?.municipio ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((token): TokenRecord => ({
        managementId: token.management_id,
        role: token.role,
        municipio: token.municipio,
        usado: token.used,
        criadoEm: token.created_at,
        expiresAt: token.expires_at,
        status: token.status,
      }));
    },
    enabled: Boolean(profile),
  });
}

export function useCriarToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, municipio, horasValidade, reason }: { role: string; municipio: string; horasValidade: number; reason: string }) => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: { token?: string } | null; error: { message: string } | null }>)('create_console_invite_token', {
        p_role: role,
        p_municipio: municipio.trim(),
        p_expires_in_minutes: Math.round(horasValidade * 60),
        p_reason: reason.trim(),
        p_operation_id: crypto.randomUUID(),
      });
      if (error) throw error;
      if (!data?.token) throw new Error('O servidor não retornou o token de convite.');
      return data.token;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tokens'] }),
  });
}
