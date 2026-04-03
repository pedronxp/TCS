/**
 * Traduz mensagens de erro do Supabase Auth para português (pt-br).
 *
 * Usa matching por `includes` (case-insensitive) para lidar com variações
 * de wording do Supabase. Strings mais específicas verificadas primeiro.
 *
 * Fallback: retorna a mensagem original sem alteração — preserva mensagens
 * pt-br já corretas (ex: 'Conta aguardando aprovação do administrador.').
 */
export function traduzirErroAuth(msg: string): string {
  const m = msg?.toLowerCase() ?? '';

  if (m.includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }

  if (m.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  }

  if (m.includes('user already registered')) {
    return 'Este e-mail já está cadastrado. Tente fazer login.';
  }

  if (m.includes('password should be at least')) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }

  if (m.includes('signup_disabled')) {
    return 'Novos cadastros estão temporariamente desativados.';
  }

  if (m.includes('over_email_send_rate_limit') || m.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  }

  if (m.includes('invalid email')) {
    return 'Endereço de e-mail inválido.';
  }

  if (m.includes('token has expired') || m.includes('is invalid')) {
    return 'Link expirado ou inválido. Solicite um novo.';
  }

  // Fallback: retornar mensagem original sem alteração
  return msg;
}
