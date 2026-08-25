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

  if (m.includes('no captcha_token found') || m.includes('captcha protection')) {
    return 'A verificação de segurança não foi concluída. Aguarde o CAPTCHA carregar e tente novamente.';
  }

  if (m.includes('captcha') || m.includes('challenge')) {
    return 'A verificação de segurança expirou ou falhou. Faça a verificação novamente.';
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

  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
    return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
  }

  // Fallback: retornar mensagem original sem alteração — preserva mensagens
  // pt-br já corretas (ex: 'Conta aguardando aprovação do administrador.').
  return msg;
}
