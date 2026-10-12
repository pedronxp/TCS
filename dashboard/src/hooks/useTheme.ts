import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'orca' | 'dracula' | 'nord' | 'gruvbox';

const STORAGE_KEY = 'tcs.console.theme';

const VALID_THEMES: Theme[] = ['light', 'dark', 'orca', 'dracula', 'nord', 'gruvbox'];

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  // Se houver 'orca' salvo anteriormente, migra para o padrao neutro 'dark'
  if (stored === 'orca') return 'dark';
  if (stored && VALID_THEMES.includes(stored)) return stored;
  // 2.0: versão branca é o padrão do produto (preview aprovado)
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
}

/** Aplica o tema imediatamente antes do paint para evitar flash. */
export function applyInitialThemeScript(): string {
  return [
    "(function(){try{var s=localStorage.getItem('" + STORAGE_KEY + "');var valid=['light','dark','orca','dracula','nord','gruvbox'];var t=(valid.indexOf(s)!==-1)?s:'light';document.documentElement.dataset.theme=t;if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.dataset.theme='light';}})();"
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
