import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, Alert } from 'react-native';
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

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@theme_preference');
      if (savedTheme) {
        setThemeModeState(savedTheme as ThemeMode);
      } else {
        // Primeira vez abrindo o app
        promptThemeSelection();
      }
    } catch (e) {
      logger.warn('system', 'Failed to load theme preference', { erro: String(e) });
    }
  };

  const promptThemeSelection = () => {
    Alert.alert(
      "Tema do Aplicativo",
      "Deseja que o app acompanhe automaticamente o tema (Claro/Escuro) do seu celular?",
      [
        {
          text: "Não, usar Modo Escuro",
          onPress: () => setThemeMode('dark'),
          style: "cancel"
        },
        {
          text: "Não, usar Modo Claro",
          onPress: () => setThemeMode('light'),
          style: "cancel"
        },
        { 
          text: "Sim, seguir sistema", 
          onPress: () => setThemeMode('system') 
        }
      ],
      { cancelable: false }
    );
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('@theme_preference', mode);
    } catch (e) {
      logger.warn('system', 'Failed to save theme preference', { erro: String(e) });
    }
  };

  const isDark = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
