import { useQuery } from '@tanstack/react-query';

export type BrazilianMunicipality = {
  id: number;
  name: string;
  uf: string;
  label: string;
};

type IbgeMunicipality = {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: string } } };
};

const IBGE_MUNICIPALITIES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';

export function useBrazilianMunicipalities(enabled = true) {
  return useQuery({
    queryKey: ['ibge-brazilian-municipalities'],
    enabled,
    staleTime: 1000 * 60 * 60 * 24,
    queryFn: async (): Promise<BrazilianMunicipality[]> => {
      const response = await fetch(IBGE_MUNICIPALITIES_URL);
      if (!response.ok) throw new Error('Não foi possível consultar a base de municípios do IBGE.');
      const data = await response.json() as IbgeMunicipality[];
      return data.map((municipality) => {
        const uf = municipality.microrregiao?.mesorregiao?.UF?.sigla
          ?? municipality['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
          ?? '';
        return { id: municipality.id, name: municipality.nome, uf, label: uf ? `${municipality.nome} — ${uf}` : municipality.nome };
      }).sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'));
    },
  });
}
