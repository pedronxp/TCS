import { useQuery } from '@tanstack/react-query';

import { BRAZILIAN_MUNICIPALITIES } from '@/data/brazilianMunicipalities';

export type BrazilianMunicipality = {
  id: number;
  name: string;
  uf: string;
  label: string;
};

/** Catálogo local (gerado do IBGE): consulta instantânea, sem dependência de serviço externo. */
export function useBrazilianMunicipalities(enabled = true) {
  return useQuery({
    queryKey: ['brazilian-municipalities'],
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<BrazilianMunicipality[]> => BRAZILIAN_MUNICIPALITIES.map(([uf, name], index) => ({
      id: index + 1,
      name,
      uf,
      label: uf ? `${name} — ${uf}` : name,
    })),
  });
}
