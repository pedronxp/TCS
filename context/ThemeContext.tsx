import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, TCSTheme } from '../constants/Colors';
import { logger } from '../utils/logger';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: TCSTheme;
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const THEME_PREFERENCE_KEY = '@theme_preference';

const ThemeContext = createContext<ThemeContextType>({
  theme: Colors.light,
  isDark: false,
  themeMode: 'system',
  setThemeMode: () => undefined,
});

export const useTheme = () => useContext(ThemeContext);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((storedMode) => {
        const mode = isThemeMode(storedMode) ? storedMode : 'system';
        setThemeModeState(mode);
        Appearance.setColorScheme(mode === 'system' ? null : mode);
      })
      .catch((error) => {
        logger.warn('system', 'Failed to restore theme preference', {
          erro: String(error),
        });
      });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    Appearance.setColorScheme(mode === 'system' ? null : mode);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, mode).catch((error) => {
      logger.warn('system', 'Failed to save theme preference', {
        erro: String(error),
      });
    });
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const theme = isDark ? Colors.dark : Colors.light;
  const value = useMemo(() => ({ theme, isDark, themeMode, setThemeMode }), [theme, isDark, themeMode, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
