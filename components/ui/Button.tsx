import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../constants/Spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  onPress: () => void;
  label?: string;
  children?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  testID?: string;
  haptic?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
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
  fullWidth = false,
  accessibilityLabel,
}: ButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const shouldHaptic = haptic ?? variant === 'primary';
  const variantStyles = getVariantStyles(variant, theme);
  const sizeStyles = getSizeStyles(size);

  const handlePress = () => {
    if (isDisabled) return;
    if (shouldHaptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onPress();
  };

  const containerStyle: ViewStyle = {
    ...styles.base,
    ...sizeStyles.container,
    ...variantStyles.container,
    opacity: isDisabled ? theme.disabledOpacity : 1,
    ...(fullWidth ? { width: '100%' } : {}),
  };

  const textStyle: TextStyle = {
    ...styles.label,
    ...sizeStyles.label,
    ...variantStyles.label,
  };

  return (
    <Pressable
      style={({ pressed }) => [
        containerStyle,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? children}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={{ color: theme.pressedOverlay, borderless: false }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.label.color} />
      ) : (
        <View style={styles.content}>
          {iconLeft ? <View style={styles.iconLeft}>{iconLeft}</View> : null}
          <Text style={[textStyle, labelStyle]}>{label ?? children}</Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
});

function getVariantStyles(
  variant: ButtonVariant,
  theme: ReturnType<typeof useTheme>['theme'],
): { container: ViewStyle; label: TextStyle } {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: theme.primary },
        label: { color: theme.onPrimary },
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: theme.secondary,
          borderWidth: 1,
          borderColor: theme.accent,
        },
        label: { color: theme.primaryDark },
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
        label: { color: theme.onPrimary },
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
          paddingHorizontal: Spacing[3],
          paddingVertical: Spacing[2],
          borderRadius: SpacingAlias.radiusSm,
          minHeight: ComponentSize.buttonSm,
        },
        label: { fontSize: FontSize.sm },
      };
    case 'md':
      return {
        container: {
          paddingHorizontal: SpacingAlias.buttonPaddingH,
          paddingVertical: SpacingAlias.buttonPaddingV,
          borderRadius: SpacingAlias.radiusMd,
          minHeight: ComponentSize.buttonMd,
        },
        label: { fontSize: FontSize.base },
      };
    case 'lg':
      return {
        container: {
          paddingHorizontal: Spacing[6],
          paddingVertical: Spacing[4],
          borderRadius: SpacingAlias.radiusMd,
          minHeight: ComponentSize.buttonLg,
        },
        label: { fontSize: FontSize.md },
      };
  }
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
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
    marginRight: Spacing[2],
  },
  iconRight: {
    marginLeft: Spacing[2],
  },
});
