import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type NivelRisco = 'r1' | 'r2' | 'r3' | 'r4';
export type FiltroPeriodo = '7d' | '30d' | '90d' | 'todos';
export type FiltroRisco = NivelRisco | 'todos';

export type Vistoria = {
  id: string;
  protocolo: string | null;
  endereco: string | null;
  enderecoRua: string | null;
  enderecoNumero: string | null;
  enderecoBairro: string | null;
  municipio: string | null;
  nivelRisco: NivelRisco | null;
  pontuacaoTotal: number | null;
  dataVistoria: string | null;
  agenteNome: string | null;
  status: string | null;
  fotoUrl: string | null;
  fotosUrls: string[] | null;
  laudo_gerado_em: string | null;
};

const BUCKETS: Record<string, string> = {
  'fotos:': 'fotos',
  'vistorias:': 'vistorias',
  'laudos:': 'laudos',
};

function escapeIlike(value: string) {
  return value.replace(/[,()]/g, ' ').replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function getSignedUrl(stored: string, expiresIn = 3600): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith('http')) return stored;
  for (const [prefix, bucket] of Object.entries(BUCKETS)) {
    if (stored.startsWith(prefix)) {
      const path = stored.slice(prefix.length);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
      return data?.signedUrl ?? null;
    }
  }
  return null;
}

export function parseFotosUrls(raw: unknown): string[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [raw];
    }
  }
  return null;
}

export function useOcorrencias(
  periodo: FiltroPeriodo,
  risco: FiltroRisco,
  municipioFiltro: string,
  busca: string
) {
  const { profile } = useAuth();
  const PAGE = 50;

  return useQuery({
    queryKey: ['ocorrencias', periodo, risco, municipioFiltro, busca, profile?.role, profile?.municipio],
    queryFn: async () => {
      let query = supabase
        .from('vistorias')
        .select(
          'id, protocolo, endereco, enderecoRua, enderecoNumero, enderecoBairro, municipio, nivelRisco, pontuacaoTotal, dataVistoria, agenteNome, status, fotoUrl, fotosUrls, laudo_gerado_em'
        )
        .order('dataVistoria', { ascending: false })
        .limit(PAGE);

      const municipio = profile?.municipio;
      if (profile?.role !== 'master_admin' && municipio) {
        query = query.eq('municipio', municipio);
      } else if (municipioFiltro) {
        query = query.eq('municipio', municipioFiltro);
      }

      if (risco !== 'todos') query = query.eq('nivelRisco', risco);

      if (periodo !== 'todos') {
        const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90;
        const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
        query = query.gte('dataVistoria', desde);
      }

      if (busca.trim()) {
        const term = `%${escapeIlike(busca.trim())}%`;
        query = query.or(
          [
            `endereco.ilike.${term}`,
            `enderecoRua.ilike.${term}`,
            `enderecoBairro.ilike.${term}`,
            `agenteNome.ilike.${term}`,
            `protocolo.ilike.${term}`,
          ].join(',')
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((v) => ({
        ...v,
        fotosUrls: parseFotosUrls(v.fotosUrls),
      })) as Vistoria[];
    },
    enabled: !!profile,
  });
}

export function filtrarBusca(vistorias: Vistoria[], busca: string): Vistoria[] {
  if (!busca.trim()) return vistorias;
  const b = busca.toLowerCase();
  return vistorias.filter((v) => {
    const end = (
      v.endereco ??
      `${v.enderecoRua ?? ''} ${v.enderecoNumero ?? ''} ${v.enderecoBairro ?? ''}`
    ).toLowerCase();
    return end.includes(b) || (v.agenteNome ?? '').toLowerCase().includes(b) || (v.protocolo ?? '').toLowerCase().includes(b);
  });
}
