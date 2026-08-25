import {
  buildTurnstileChallengeHtml,
  getTurnstileConfiguration,
  parseTurnstileMessage,
  resolveTurnstileConfiguration,
} from '../TurnstileService';

describe('TurnstileService', () => {
  it('não altera o login enquanto a chave pública não for configurada', () => {
    const config = resolveTurnstileConfiguration(null, null);
    expect(config.enabled).toBe(false);
    expect(config.siteKey).toBeNull();
  });

  it('mantém a chave pública disponível no Expo local quando não há arquivo de ambiente', () => {
    expect(getTurnstileConfiguration()).toMatchObject({
      enabled: true,
      siteKey: '0x4AAAAAAEZrvk6QszB6lWKY',
      origin: 'https://tcsvistoria.pages.dev',
    });
  });

  it('aceita somente uma chave pública válida e uma origem segura', () => {
    const config = resolveTurnstileConfiguration('1x00000000000000000000AA', 'https://tcsvistoria.pages.dev/login');
    expect(config).toMatchObject({
      enabled: true,
      siteKey: '1x00000000000000000000AA',
      origin: 'https://tcsvistoria.pages.dev',
    });
    expect(resolveTurnstileConfiguration('<script>alert(1)</script>', 'javascript:alert(1)').enabled).toBe(false);
  });

  it('gera o desafio sem incluir qualquer chave secreta', () => {
    const config = resolveTurnstileConfiguration('1x00000000000000000000AA', null);
    const html = buildTurnstileChallengeHtml(config);
    expect(html.includes('challenges.cloudflare.com/turnstile')).toBe(true);
    expect(html.includes('1x00000000000000000000AA')).toBe(true);
  });

  it('aceita somente mensagens válidas emitidas pelo desafio TCS', () => {
    expect(parseTurnstileMessage(JSON.stringify({
      source: 'tcs-turnstile',
      type: 'verified',
      token: 'token-de-verificacao-valido',
    }))).toBe('token-de-verificacao-valido');
    expect(parseTurnstileMessage({ source: 'outra-origem', type: 'verified', token: 'token-valido' })).toBeNull();
    expect(parseTurnstileMessage('mensagem inválida')).toBeNull();
  });
});
