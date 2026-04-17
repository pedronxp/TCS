import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PinVistoria = {
  id: string;
  lat: number;
  lng: number;
  nivelRisco: 'r1' | 'r2' | 'r3' | 'r4';
  endereco: string | null;
  municipio: string | null;
  agenteNome: string | null;
  dataVistoria: string | null;
  protocolo: string | null;
};

export type PinAgendamento = {
  id: string;
  lat: number;
  lng: number;
  titulo: string | null;
  endereco: string | null;
  municipio: string | null;
  agente_nome: string | null;
  data_agendada: string | null;
  status: string;
};

export function useMapaDados() {
  const { profile } = useAuth();

  const vistorias = useQuery({
    queryKey: ['mapa-vistorias', profile?.role, profile?.municipio],
    queryFn: async () => {
      let q = supabase
        .from('vistorias')
        .select('id, latitude, longitude, "nivelRisco", endereco, municipio, "agenteNome", "dataVistoria", protocolo')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (profile?.role !== 'master_admin') {
        q = q.eq('municipio', profile?.municipio);
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((v) => ({
        id: v.id,
        lat: v.latitude as number,
        lng: v.longitude as number,
        nivelRisco: v.nivelRisco as PinVistoria['nivelRisco'],
        endereco: v.endereco,
        municipio: v.municipio,
        agenteNome: v.agenteNome,
        dataVistoria: v.dataVistoria,
        protocolo: v.protocolo,
      })) as PinVistoria[];
    },
    enabled: !!profile,
  });

  const agendamentos = useQuery({
    queryKey: ['mapa-agendamentos', profile?.role, profile?.municipio],
    queryFn: async () => {
      let q = supabase
        .from('agendamentos')
        .select('id, lat, lng, titulo, endereco, municipio, agente_nome, data_agendada, status')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .eq('status', 'pendente');

      if (profile?.role !== 'master_admin') {
        q = q.eq('municipio', profile?.municipio);
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((a) => ({
        id: a.id,
        lat: a.lat as number,
        lng: a.lng as number,
        titulo: a.titulo,
        endereco: a.endereco,
        municipio: a.municipio,
        agente_nome: a.agente_nome,
        data_agendada: a.data_agendada,
        status: a.status,
      })) as PinAgendamento[];
    },
    enabled: !!profile,
  });

  return { vistorias, agendamentos };
}
