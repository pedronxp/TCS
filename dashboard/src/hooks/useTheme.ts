import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tcs.console.theme';

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  // Dark e o padrao Apple do produto; respeita o SO apenas na primeira visita.
  const hasMatchMedia = typeof window.matchMedia === 'function';
  const prefersLight = hasMatchMedia ? window.matchMedia('(prefers-color-scheme: light)').matches : false;
  return prefersLight ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

/** Aplica o tema imediatamente antes do paint para evitar flash. */
export function applyInitialThemeScript(): string {
  return [
    "(function(){try{var s=localStorage.getItem('" + STORAGE_KEY + "');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();"
  ].join("");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme };
}
