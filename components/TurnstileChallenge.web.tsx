import React, { useEffect, useMemo, useRef } from 'react';
import {
  buildTurnstileChallengeHtml,
  parseTurnstileMessage,
  type TurnstileConfiguration,
} from '../services/TurnstileService';

interface Props {
  configuration: TurnstileConfiguration;
  onToken: (token: string | null) => void;
}

export function TurnstileChallenge({ configuration, onToken }: Props) {
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => buildTurnstileChallengeHtml(configuration), [configuration]);

  useEffect(() => {
    if (!configuration.enabled) return;

    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) {
        return;
      }
      onToken(parseTurnstileMessage(event.data));
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [configuration.enabled, onToken]);

  if (!configuration.enabled || !html) return null;

  return (
    <iframe
      ref={iframe}
      title="Verificação de segurança Cloudflare"
      srcDoc={html}
      style={{ width: '100%', minHeight: 72, border: 0, background: 'transparent' }}
    />
  );
}
