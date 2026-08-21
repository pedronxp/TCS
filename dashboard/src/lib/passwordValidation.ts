/**
 * Regras de validação de senha — política única do TCS (espelha utils/passwordValidation.ts).
 * Mínimo: 8 caracteres, ao menos 1 letra e ao menos 1 número.
 */

export interface SenhaValidationResult {
  valido: boolean;
  erro?: string;
}

export function validarSenha(senha: string): SenhaValidationResult {
  if (!senha || senha.length < 8) {
    return { valido: false, erro: 'A senha deve ter no mínimo 8 caracteres.' };
  }
  if (!/[a-zA-Z]/.test(senha)) {
    return { valido: false, erro: 'A senha deve conter pelo menos uma letra.' };
  }
  if (!/[0-9]/.test(senha)) {
    return { valido: false, erro: 'A senha deve conter pelo menos um número.' };
  }
  return { valido: true };
}

/**
 * Calcula a força visual da senha (0 = fraca, 1 = média, 2 = forte).
 *  - 0: menos de 8 caracteres
 *  - 1: 8+ caracteres, tem letra e número
 *  - 2: 10+ caracteres, tem letra, número e caractere especial
 */
export function calcularForcaSenha(senha: string): 0 | 1 | 2 {
  if (senha.length < 8) return 0;
  const temLetra = /[a-zA-Z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);
  if (!temLetra || !temNumero) return 0;
  if (senha.length >= 10 && /[^A-Za-z0-9]/.test(senha)) return 2;
  return 1;
}

export const FORCA_LABELS = ['Fraca', 'Média', 'Forte'] as const;
export const FORCA_CORES = ['#EF4444', '#F59E0B', '#10B981'] as const;
export const SENHA_MAX = 128;
