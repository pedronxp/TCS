import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

interface TurnstileRenderOptions {
  sitekey: string;
  theme: 'auto';
  size: 'flexible';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
// A Site Key é pública. O fallback mantém o widget presente em builds feitos
// fora do Netlify (por exemplo, Cloudflare Pages), onde netlify.toml não injeta
// variáveis no Vite.
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '0x4AAAAAAEZrvk6QszB6lWKY';
let scriptReady: Promise<void> | null = null;

export const turnstileEnabled = siteKey.length > 0;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptReady) return scriptReady;

  scriptReady = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tcs-turnstile="true"]');
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      scriptReady = null;
      reject(new Error('Não foi possível carregar a verificação de segurança.'));
    }, { once: true });

    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.tcsTurnstile = 'true';
      document.head.appendChild(script);
    }
  });

  return scriptReady;
}

export function TurnstileChallenge({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(turnstileEnabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!turnstileEnabled) return;
    let active = true;
    let widgetId: string | null = null;

    void loadTurnstileScript()
      .then(() => {
        if (!active || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          theme: 'auto',
          size: 'flexible',
          callback: (token) => {
            if (!active) return;
            setError(null);
            onToken(token);
          },
          'expired-callback': () => {
            if (active) onToken(null);
          },
          'error-callback': () => {
            if (!active) return;
            onToken(null);
            setError('Não foi possível confirmar a verificação. Atualize a página e tente novamente.');
          },
        });
        setLoading(false);
      })
      .catch((cause) => {
        if (!active) return;
        onToken(null);
        setLoading(false);
        setError(cause instanceof Error ? cause.message : 'Verificação de segurança indisponível.');
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);

  if (!turnstileEnabled) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        Verificação de segurança
      </div>
      {loading && (
        <div className="flex min-h-16 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Preparando a verificação…
        </div>
      )}
      <div ref={container} className={loading ? 'hidden' : 'min-h-16'} />
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}
