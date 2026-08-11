import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type UserRecord = {
  uid: string;
  name: string;
  email: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
  municipio: string | null;
};

export type FiltroUsuario = 'todos' | 'ativos' | 'pendentes';

export function useUsuarios(filtro: FiltroUsuario, busca: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['usuarios', filtro, busca, profile?.role, profile?.municipio],
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select('uid, name, email, role, "isApproved", "createdAt", municipio')
        .neq('role', 'master_admin')
        .order('name');

      const municipio = profile?.municipio;
      if (profile?.role !== 'master_admin' && municipio) {
        query = query.eq('municipio', municipio);
      }

      if (filtro === 'ativos') query = query.eq('isApproved', true);
      if (filtro === 'pendentes') query = query.eq('isApproved', false);

      const { data, error } = await query;
      if (error) throw error;

      let result = (data ?? []) as UserRecord[];

      if (busca.trim()) {
        const b = busca.toLowerCase();
        result = result.filter(
          (u) =>
            u.name?.toLowerCase().includes(b) ||
            u.email?.toLowerCase().includes(b) ||
            u.municipio?.toLowerCase().includes(b)
        );
      }

      return result;
    },
    enabled: !!profile,
  });
}

export function useToggleAprovacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uid, isApproved }: { uid: string; isApproved: boolean }) => {
      const { error } = await supabase
        .from('users')
        .update({ isApproved })
        .eq('uid', uid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useResetSenha() {
  return useMutation({
    mutationFn: async ({ uid, password }: { uid: string; password: string }) => {
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)('internal_reset_password', {
        p_target_user_id: uid,
        p_new_password: password,
      });
      if (error) throw error;
      return data;
    },
  });
}
