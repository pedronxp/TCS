import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type StatusAgendamento = 'pendente' | 'concluido' | 'cancelado';

export type Agendamento = {
  id: string;
  titulo: string | null;
  endereco: string | null;
  municipio: string | null;
  data_agendada: string | null;
  criado_por_uid: string | null;
  criado_por_nome: string | null;
  agente_uid: string | null;
  agente_nome: string | null;
  observacoes: string | null;
  status: StatusAgendamento;
  criado_em: string | null;
};

export type FiltroStatus = StatusAgendamento | 'todos';
export type FiltroPeriodo = 'proximos' | 'passados' | 'todos';

export function useAgendamentos(
  filtroStatus: FiltroStatus,
  filtroPeriodo: FiltroPeriodo,
  municipioFiltro: string,
  busca: string
) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['agendamentos', filtroStatus, filtroPeriodo, municipioFiltro, busca, profile?.role, profile?.municipio],
    queryFn: async () => {
      let query = supabase
        .from('agendamentos')
        .select('id, titulo, endereco, municipio, data_agendada, criado_por_nome, agente_nome, observacoes, status, criado_em')
        .order('data_agendada', { ascending: true });

      if (profile?.role !== 'master_admin') {
        query = query.eq('municipio', profile?.municipio);
      } else if (municipioFiltro) {
        query = query.eq('municipio', municipioFiltro);
      }

      if (filtroStatus !== 'todos') query = query.eq('status', filtroStatus);

      if (filtroPeriodo === 'proximos') {
        query = query.gte('data_agendada', new Date().toISOString());
      } else if (filtroPeriodo === 'passados') {
        query = query.lt('data_agendada', new Date().toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = (data ?? []) as Agendamento[];

      if (busca.trim()) {
        const b = busca.toLowerCase();
        result = result.filter(
          (a) =>
            (a.titulo ?? '').toLowerCase().includes(b) ||
            (a.endereco ?? '').toLowerCase().includes(b) ||
            (a.agente_nome ?? '').toLowerCase().includes(b)
        );
      }

      return result;
    },
    enabled: !!profile,
  });
}

export function useAtualizarStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusAgendamento }) => {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agendamentos'] }),
  });
}
