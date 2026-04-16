import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type TokenRecord = {
  codigo: string;
  role: string;
  municipio: string | null;
  criadoPor: string | null;
  usado: boolean;
  criadoEm: string;
  expiresAt: string | null;
  notificadoExpirando: boolean;
};

export function useTokens() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['tokens', profile?.role, profile?.municipio],
    queryFn: async () => {
      let query = supabase
        .from('invite_tokens')
        .select('*')
        .order('criadoEm', { ascending: false });

      if (profile?.role !== 'master_admin') {
        query = query.eq('municipio', profile?.municipio);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TokenRecord[];
    },
    enabled: !!profile,
  });
}

function gerarCodigo(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

export function useCriarToken() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      role,
      municipio,
      horasValidade,
    }: {
      role: string;
      municipio: string;
      horasValidade: number;
    }) => {
      const codigo = gerarCodigo();
      const expiresAt = new Date(Date.now() + horasValidade * 3_600_000).toISOString();

      const { error } = await supabase.from('invite_tokens').insert({
        codigo,
        role,
        municipio,
        criadoPor: profile?.uid,
        usado: false,
        criadoEm: new Date().toISOString(),
        expiresAt,
      });
      if (error) throw error;
      return codigo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}

export function useCancelarToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (codigo: string) => {
      const { error } = await supabase.from('invite_tokens').delete().eq('codigo', codigo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}

export function useLimparTokens() {
  const qc = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (tipo: 'expirados' | 'usados') => {
      let query = supabase.from('invite_tokens').delete();

      if (profile?.role !== 'master_admin') {
        query = query.eq('municipio', profile?.municipio);
      }

      if (tipo === 'expirados') {
        query = query.lt('expiresAt', new Date().toISOString()).eq('usado', false);
      } else {
        query = query.eq('usado', true);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  });
}
