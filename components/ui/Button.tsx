// components/ui/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  label?: string;
  children?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Ícone à esquerda do label — elemento React (ex: <Feather name="plus" />) */
  iconLeft?: React.ReactNode;
  /** Ícone à direita do label */
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  testID?: string;
  /** Habilita feedback haptico no press (padrão: true para primary) */
  haptic?: boolean;
}

export const Button = React.memo(function Button({
  onPress,
  label,
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  labelStyle,
  testID,
  haptic,
}: ButtonProps) {
  const { theme, isDark } = useTheme();

  const isDisabled = disabled || loading;
  const shouldHaptic = haptic ?? (variant === 'primary');

  const handlePress = () => {
    if (isDisabled) return;
    if (shouldHaptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  // ── Cores por variante ──
  const variantStyles = getVariantStyles(variant, theme, isDark);

  // ── Tamanhos ──
  const sizeStyles = getSizeStyles(size);

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles.container,
    ...variantStyles.container,
    opacity: isDisabled ? 0.5 : 1,
  };

  const textStyle: TextStyle = {
    ...styles.label,
    ...sizeStyles.label,
    ...variantStyles.label,
  };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.75}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.label.color}
        />
      ) : (
        <View style={styles.content}>
          {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}
          <Text style={[textStyle, labelStyle]}>{label ?? children}</Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
});

// ── Helpers de estilo ──

function getVariantStyles(
  variant: ButtonVariant,
  theme: ReturnType<typeof useTheme>['theme'],
  isDark: boolean
): { container: ViewStyle; label: TextStyle } {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: theme.primary },
        label: { color: '#FFFFFF' },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: theme.primaryLight,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
        },
        label: { color: theme.primary },
      };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.border,
        },
        label: { color: theme.text },
      };
    case 'danger':
      return {
        container: { backgroundColor: theme.error },
        label: { color: '#FFFFFF' },
      };
  }
}

function getSizeStyles(size: ButtonSize): {
  container: ViewStyle;
  label: TextStyle;
} {
  switch (size) {
    case 'sm':
      return {
        container: {
          paddingHorizontal: Spacing[3],  // 12
          paddingVertical: Spacing[2],    // 8
          borderRadius: SpacingAlias.radiusSm, // 6
          minHeight: 36,
        },
        label: { fontSize: FontSize.sm },  // 12
      };
    case 'md':
      return {
        container: {
          paddingHorizontal: SpacingAlias.buttonPaddingH,  // 16
          paddingVertical: SpacingAlias.buttonPaddingV,    // 12
          borderRadius: SpacingAlias.radiusMd,             // 12
          minHeight: 48,
        },
        label: { fontSize: FontSize.base },  // 14
      };
    case 'lg':
      return {
        container: {
          paddingHorizontal: Spacing[6],   // 24
          paddingVertical: Spacing[4],     // 16
          borderRadius: SpacingAlias.radiusMd,
          minHeight: 56,
        },
        label: { fontSize: FontSize.md },  // 16
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: Spacing[2],  // 8
  },
  iconRight: {
    marginLeft: Spacing[2],  // 8
  },
});
