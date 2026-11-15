import { BRAZILIAN_MUNICIPALITIES } from '../constants/brazilianMunicipalities';

export const TOKEN_MUNICIPALITIES = BRAZILIAN_MUNICIPALITIES.map(([uf, nome]) => ({ nome, uf }));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function searchTokenMunicipalities(query: string) {
  const normalized = normalize(query);
  const term = normalized === 'bh' ? 'belo horizonte' : normalized;
  const words = term.split(/\s+/).filter(Boolean);
  return TOKEN_MUNICIPALITIES.filter(city => {
    const label = normalize(`${city.nome} ${city.uf}`);
    return words.every(word => label.includes(word));
  });
}
