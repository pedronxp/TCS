export const MAX_LENGTHS = {
  nome: 100,
  endereco: 200,
  municipio: 80,
  cep: 9,
  observacoes: 2000,
  email: 254,
};

const HTML_PATTERN = /<[^>]*>/;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

/** Remove espaços extras e control chars. */
export function sanitizarTexto(texto: string): string {
  return texto.trim().replace(CONTROL_CHARS, '').substring(0, 2000);
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= MAX_LENGTHS.email;
}

export function validarCep(cep: string): boolean {
  const numeros = cep.replace(/\D/g, '');
  return numeros.length === 8;
}

export function validarNome(
  nome: string,
  campo = 'Nome'
): { valido: boolean; erro?: string } {
  const limpo = nome.trim();
  if (!limpo) return { valido: false, erro: `${campo} é obrigatório` };
  if (limpo.length > MAX_LENGTHS.nome) return { valido: false, erro: `${campo}: máximo ${MAX_LENGTHS.nome} caracteres` };
  if (HTML_PATTERN.test(limpo)) return { valido: false, erro: `${campo}: caracteres inválidos` };
  return { valido: true };
}

export function validarEndereco(
  valor: string,
  campo = 'Endereço'
): { valido: boolean; erro?: string } {
  const limpo = valor.trim();
  if (!limpo) return { valido: false, erro: `${campo} é obrigatório` };
  if (limpo.length > MAX_LENGTHS.endereco) return { valido: false, erro: `${campo}: máximo ${MAX_LENGTHS.endereco} caracteres` };
  if (HTML_PATTERN.test(limpo)) return { valido: false, erro: `${campo}: caracteres inválidos` };
  return { valido: true };
}

export function validarMunicipio(municipio: string): { valido: boolean; erro?: string } {
  const limpo = municipio.trim();
  if (!limpo) return { valido: false, erro: 'Município é obrigatório' };
  if (limpo.length > MAX_LENGTHS.municipio) return { valido: false, erro: `Município: máximo ${MAX_LENGTHS.municipio} caracteres` };
  return { valido: true };
}
