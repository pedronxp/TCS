import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Elevation, SpacingAlias } from '../../constants/Spacing';

export type CardVariant = 'default' | 'variant' | 'flat' | 'outlined';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  noPadding?: boolean;
  variant?: CardVariant;
  testID?: string;
  accessibilityLabel?: string;
}

export const Card = React.memo(function Card({
  children,
  style,
  onPress,
  noPadding = false,
  variant = 'default',
  testID,
  accessibilityLabel,
}: CardProps) {
  const { theme } = useTheme();

  const backgroundColor =
    variant === 'variant' ? theme.surfaceVariant :
    variant === 'flat' ? 'transparent' :
    theme.surface;

  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      backgroundColor,
      borderColor: theme.border,
      borderWidth: variant === 'flat' ? 0 : 1,
    },
    variant === 'default' ? styles.elevated : {},
    !noPadding ? styles.padding : {},
    style ?? {},
  ];

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [containerStyle, pressed && styles.pressed]}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: theme.pressedOverlay, borderless: false }}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle} testID={testID}>{children}</View>;
});

const styles = StyleSheet.create({
  base: {
    borderRadius: SpacingAlias.radiusMd,
    overflow: 'hidden',
  },
  padding: {
    padding: SpacingAlias.cardPaddingHorizontal,
  },
  elevated: {
    shadowColor: '#171A18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: Elevation.card,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
});
