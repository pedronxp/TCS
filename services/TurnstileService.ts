export interface TurnstileConfiguration {
  enabled: boolean;
  siteKey: string | null;
  origin: string;
}

const DEFAULT_TURNSTILE_ORIGIN = 'https://tcsvisto.netlify.app';
// A Site Key do Turnstile é pública por definição. Mantê-la como fallback
// evita que o Expo local omita o captchaToken quando a proteção global do
// Supabase está ativa. A Secret Key permanece somente no servidor.
const DEFAULT_TURNSTILE_SITE_KEY = '0x4AAAAAAEZrvk6QszB6lWKY';
const SITE_KEY_FORMAT = /^[A-Za-z0-9_-]{10,200}$/;

export function resolveTurnstileConfiguration(
  rawSiteKey?: string | null,
  rawOrigin?: string | null,
): TurnstileConfiguration {
  const siteKey = rawSiteKey?.trim() || null;
  const origin = rawOrigin?.trim() || DEFAULT_TURNSTILE_ORIGIN;

  let normalizedOrigin = DEFAULT_TURNSTILE_ORIGIN;
  try {
    const parsed = new URL(origin);
    const localhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && localhost)) {
      normalizedOrigin = parsed.origin;
    }
  } catch {
    // Uma origem inválida nunca é interpolada no HTML do desafio.
  }

  return {
    enabled: Boolean(siteKey && SITE_KEY_FORMAT.test(siteKey)),
    siteKey: siteKey && SITE_KEY_FORMAT.test(siteKey) ? siteKey : null,
    origin: normalizedOrigin,
  };
}

export function getTurnstileConfiguration(): TurnstileConfiguration {
  return resolveTurnstileConfiguration(
    process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || DEFAULT_TURNSTILE_SITE_KEY,
    process.env.EXPO_PUBLIC_TURNSTILE_ORIGIN,
  );
}

export function buildTurnstileChallengeHtml(configuration: TurnstileConfiguration): string {
  if (!configuration.enabled || !configuration.siteKey) return '';
  const siteKey = JSON.stringify(configuration.siteKey).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
    <style>html,body{margin:0;background:transparent}#challenge{min-height:66px}</style>
  </head>
  <body>
    <div id="challenge"></div>
    <script>
      (function () {
        var siteKey = ${siteKey};
        function notify(type, token) {
          var payload = { source: 'tcs-turnstile', type: type, token: token || null };
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } else if (window.parent !== window) {
            window.parent.postMessage(payload, window.location.origin);
          }
        }
        function render() {
          if (!window.turnstile) { setTimeout(render, 80); return; }
          window.turnstile.render('#challenge', {
            sitekey: siteKey,
            theme: 'auto',
            language: 'pt-br',
            callback: function (token) { notify('verified', token); },
            'expired-callback': function () { notify('expired'); },
            'error-callback': function () { notify('error'); }
          });
        }
        render();
      })();
    </script>
  </body>
</html>`;
}

export function parseTurnstileMessage(value: unknown): string | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value;
    if (!parsed || typeof parsed !== 'object') return null;
    const message = parsed as { source?: unknown; type?: unknown; token?: unknown };
    if (message.source !== 'tcs-turnstile' || message.type !== 'verified') return null;
    return typeof message.token === 'string' && message.token.trim().length >= 10
      ? message.token
      : null;
  } catch {
    return null;
  }
}
