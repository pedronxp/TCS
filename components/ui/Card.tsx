// components/ui/Card.tsx
import React from 'react';
import { View, ViewStyle, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  /** Remove padding interno — útil para conteúdo que ocupa toda a largura */
  noPadding?: boolean;
  /** Variante com fundo alternado (surfaceVariant) */
  variant?: 'default' | 'variant' | 'flat';
  testID?: string;
}

export const Card = React.memo(function Card({
  children,
  style,
  onPress,
  noPadding = false,
  variant = 'default',
  testID,
}: CardProps) {
  const { theme, isDark } = useTheme();

  const bgColor =
    variant === 'variant' ? theme.surfaceVariant :
    variant === 'flat'    ? 'transparent'        :
    theme.surface;

  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      backgroundColor: bgColor,
      borderColor: theme.cardBorder,
      // Sombra só no light mode — no dark fica border sutil
      ...(isDark
        ? { borderWidth: 1 }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }
      ),
    },
    !noPadding && styles.padding,
    style,
  ].filter(Boolean) as ViewStyle[];

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.75}
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: SpacingAlias.radiusMd,   // 12
    overflow: 'hidden',
  },
  padding: {
    padding: SpacingAlias.cardPaddingHorizontal,  // 16
  },
});
