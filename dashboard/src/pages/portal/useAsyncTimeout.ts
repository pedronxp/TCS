import { useEffect, useState } from 'react';

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Porta do guard de timeout do AsyncBoundary (padrão do console) para os
 * estados do portal: enquanto `loading` persiste além do limite, a página
 * deve trocar o skeleton por uma falha explícita com tentativa de repetir
 * em vez de girar para sempre quando a consulta travar.
 */
export function useAsyncTimeout(loading: boolean, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [loading, timeoutMs]);

  return timedOut;
}
