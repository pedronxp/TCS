export const RESPOSTA_ESPECIAL_INEXISTENTE_OU_INOPERANTE = '__inexistente_ou_inoperante__';
export const RESPOSTA_ESPECIAL_LABEL = 'Inoperante ou inexistente';

export const ehRespostaEspecial = (valor: unknown): valor is string =>
  valor === RESPOSTA_ESPECIAL_INEXISTENTE_OU_INOPERANTE;

export const formatarRespostaEspecial = (valor: unknown): string | null =>
  ehRespostaEspecial(valor) ? RESPOSTA_ESPECIAL_LABEL : null;

export const temRespostaValida = (valor: unknown): boolean => {
  if (ehRespostaEspecial(valor)) return true;
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  return valor !== null && valor !== undefined;
};
