import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/Colors';
import { logger } from '../utils/logger';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: typeof Colors.light;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: Colors.dark,
  isDark: true,
  themeMode: 'system',
  setThemeMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

/**
 * Resolve o esquema de cores do sistema.
 * useColorScheme() pode retornar null no Expo Go antes do sistema
 * fornecer o valor. Nesse caso, consultamos Appearance.getColorScheme()
 * como fallback. Se ambos forem null, assumimos 'dark' para manter a
 * identidade visual padrão do app.
 */
function resolveSystemScheme(hookValue: ReturnType<typeof useColorScheme>): 'light' | 'dark' {
  if (hookValue) return hookValue;
  const fallback = Appearance.getColorScheme();
  return fallback ?? 'dark';
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  // Carrega preferência salva (apenas uma vez)
  useEffect(() => {
    AsyncStorage.getItem('@theme_preference')
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        } else {
          // Primeira vez: padrão = seguir sistema
          AsyncStorage.setItem('@theme_preference', 'system').catch(() => {});
        }
      })
      .catch((e) => {
        logger.warn('system', 'Failed to load theme preference', { erro: String(e) });
      })
      .finally(() => setReady(true));
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('@theme_preference', mode);
    } catch (e) {
      logger.warn('system', 'Failed to save theme preference', { erro: String(e) });
    }
  }, []);

  // Calcula o tema efetivo
  const resolvedSystem = resolveSystemScheme(systemColorScheme);
  const isDark =
    themeMode === 'system'
      ? resolvedSystem === 'dark'
      : themeMode === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  // Enquanto carrega a preferência, mostra o tema do sistema para não piscar
  if (!ready) {
    const bootTheme = resolvedSystem === 'dark' ? Colors.dark : Colors.light;
    return (
      <ThemeContext.Provider
        value={{ theme: bootTheme, isDark: resolvedSystem === 'dark', themeMode: 'system', setThemeMode }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

